import { MarkdownView, Menu, Plugin, TFile } from "obsidian";
import {
    DEFAULT_SETTINGS,
    HidePropertiesSettingTab,
    HidePropertiesSettings,
} from "./settings";

const DISCLOSURE_CLASS = "hide-properties-disclosure";
const PATCH_MARKER = "__hidePropertiesPatched";

interface ViewState {
    observer: MutationObserver | null;
    debounceHandle: ReturnType<typeof setTimeout> | null;
    container: HTMLElement | null;
}

export default class HidePropertiesPlugin extends Plugin {
    settings: HidePropertiesSettings;
    private viewStates: WeakMap<MarkdownView, ViewState> = new WeakMap();
    private expandedState = new Map<string, boolean>();
    private viewExpandedState = new WeakMap<MarkdownView, boolean>();
    _origShowAtMouseEvent: typeof Menu.prototype.showAtMouseEvent;

    async onload() {
        await this.loadSettings();
        this.addSettingTab(new HidePropertiesSettingTab(this.app, this));

        // Monkey-patch Menu.prototype.showAtMouseEvent to inject into property context menus.
        // Guard against double-patching if the plugin is reloaded during development.
        if (!(Menu.prototype.showAtMouseEvent as any)[PATCH_MARKER]) {
            const plugin = this;
            this._origShowAtMouseEvent = Menu.prototype.showAtMouseEvent;
            const patched = function (this: Menu, e: MouseEvent) {
                const target = e.target as HTMLElement;
                const propertyEl = target.closest<HTMLElement>(".metadata-property[data-property-key]");
                if (propertyEl) {
                    const key = propertyEl.getAttribute("data-property-key");
                    if (key) {
                        const isHidden = plugin.settings.hiddenProperties.includes(key);
                        this.addSeparator();
                        this.addItem((item) =>
                            item
                                .setTitle(isHidden ? "Unhide property" : "Hide property")
                                .setIcon(isHidden ? "eye" : "eye-off")
                                .onClick(async () => {
                                    if (isHidden) {
                                        plugin.settings.hiddenProperties =
                                            plugin.settings.hiddenProperties.filter((p) => p !== key);
                                    } else if (!plugin.settings.hiddenProperties.includes(key)) {
                                        plugin.settings.hiddenProperties.push(key);
                                    }
                                    await plugin.saveSettings();
                                    plugin.patchAllViews();
                                })
                        );
                    }
                }
                return plugin._origShowAtMouseEvent.call(this, e);
            };
            (patched as any)[PATCH_MARKER] = true;
            Menu.prototype.showAtMouseEvent = patched;
        }

        // On active leaf change, only patch that leaf (not all views)
        this.registerEvent(
            this.app.workspace.on("active-leaf-change", (leaf) => {
                setTimeout(() => {
                    if (leaf?.view instanceof MarkdownView) {
                        this.patchView(leaf.view);
                    }
                }, 100);
            })
        );

        // Patch on layout change (new panes opened, etc.)
        this.registerEvent(
            this.app.workspace.on("layout-change", () => {
                setTimeout(() => this.patchAllViews(), 100);
            })
        );

        // Re-patch when frontmatter changes for a file
        this.registerEvent(
            this.app.metadataCache.on("changed", (file: TFile) => {
                this.patchViewsForFile(file);
            })
        );

        // Initial patch of all currently open views
        this.app.workspace.onLayoutReady(() => {
            this.patchAllViews();
        });
    }

    onunload() {
        // Restore the original Menu method
        if (this._origShowAtMouseEvent) {
            Menu.prototype.showAtMouseEvent = this._origShowAtMouseEvent;
        }

        this.expandedState.clear();

        // Disconnect all observers and restore all hidden elements
        this.app.workspace.iterateAllLeaves((leaf) => {
            const view = leaf.view;
            if (!(view instanceof MarkdownView)) return;

            const state = this.viewStates.get(view);
            if (state) {
                state.observer?.disconnect();
                if (state.debounceHandle !== null) {
                    clearTimeout(state.debounceHandle);
                }
            }

            const container = this.getPropertiesContainer(view);
            if (!container) return;

            container.querySelectorAll(`.${DISCLOSURE_CLASS}`).forEach((el) => el.remove());

            container
                .querySelectorAll<HTMLElement>(".metadata-property[data-property-key]")
                .forEach((el) => {
                    el.style.display = "";
                });
        });
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    patchAllViews() {
        this.app.workspace.iterateAllLeaves((leaf) => {
            const view = leaf.view;
            if (view instanceof MarkdownView) {
                this.patchView(view);
            }
        });
    }

    private patchViewsForFile(file: TFile) {
        this.app.workspace.iterateAllLeaves((leaf) => {
            const view = leaf.view;
            if (!(view instanceof MarkdownView)) return;
            if (view.file?.path === file.path) {
                this.patchView(view);
            }
        });
    }

    private getPropertiesContainer(view: MarkdownView): HTMLElement | null {
        return view.contentEl.querySelector(".metadata-properties");
    }

    patchView(view: MarkdownView) {
        const container = this.getPropertiesContainer(view);
        if (!container) return;

        this.applyPatching(view, container);
        this.ensureObserver(view, container);
    }

    private applyPatching(view: MarkdownView, container: HTMLElement) {
        const hiddenSet = new Set(this.settings.hiddenProperties);
        const filePath = view.file?.path;

        // Disconnect observer while we mutate the DOM to prevent re-entrancy loop
        const state = this.viewStates.get(view);
        state?.observer?.disconnect();

        try {
            // Remove any previously injected disclosure elements
            container.querySelectorAll(`.${DISCLOSURE_CLASS}`).forEach((el) => el.remove());

            // If no hidden properties configured, restore all and bail
            if (hiddenSet.size === 0) {
                container
                    .querySelectorAll<HTMLElement>(".metadata-property[data-property-key]")
                    .forEach((el) => {
                        el.style.display = "";
                    });
                return;
            }

            const hiddenEls: HTMLElement[] = [];

            container
                .querySelectorAll<HTMLElement>(".metadata-property[data-property-key]")
                .forEach((el) => {
                    const key = el.getAttribute("data-property-key");
                    if (key && hiddenSet.has(key)) {
                        el.style.display = "none";
                        hiddenEls.push(el);
                    } else {
                        el.style.display = "";
                    }
                });

            // No properties in this note match the hidden list — nothing to do
            if (hiddenEls.length === 0) return;

            // Build disclosure element
            const disclosure = document.createElement("div");
            disclosure.className = DISCLOSURE_CLASS;

            // Restore per-note expanded state (per-view for unsaved notes)
            let expanded = filePath
                ? (this.expandedState.get(filePath) ?? false)
                : (this.viewExpandedState.get(view) ?? false);

            const updateDisclosure = () => {
                disclosure.textContent = `${expanded ? "▼" : "▶"} Hidden (${hiddenEls.length})`;
                for (const el of hiddenEls) {
                    el.style.display = expanded ? "" : "none";
                }
            };

            disclosure.addEventListener("click", () => {
                expanded = !expanded;
                if (filePath) this.expandedState.set(filePath, expanded);
                else this.viewExpandedState.set(view, expanded);
                updateDisclosure();
            });

            updateDisclosure();
            container.appendChild(disclosure);

            // Move hidden elements to after the disclosure so they appear below it when expanded
            for (const el of hiddenEls) {
                container.appendChild(el);
            }
        } finally {
            // Reconnect observer after all DOM changes are done
            if (state?.observer) {
                state.observer.observe(container, { childList: true, subtree: false });
            }
        }
    }

    private ensureObserver(view: MarkdownView, container: HTMLElement) {
        let state = this.viewStates.get(view);

        // Already watching this exact container — nothing to do
        if (state?.observer && state.container === container) return;

        // Container changed or first setup — disconnect any stale observer
        if (state?.observer) {
            state.observer.disconnect();
            state.observer = null;
            state.container = null;
        }

        // Create state if needed so the observer callback can update debounceHandle on it directly
        if (!state) {
            state = { observer: null, debounceHandle: null, container: null };
            this.viewStates.set(view, state);
        }

        const observer = new MutationObserver(() => {
            if (state!.debounceHandle !== null) clearTimeout(state!.debounceHandle);
            state!.debounceHandle = setTimeout(() => {
                const freshContainer = this.getPropertiesContainer(view);
                if (freshContainer) {
                    this.applyPatching(view, freshContainer);
                }
                state!.debounceHandle = null;
            }, 80);
        });

        state.observer = observer;
        state.container = container;
        observer.observe(container, { childList: true, subtree: false });
    }
}
