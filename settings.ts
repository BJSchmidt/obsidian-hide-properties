import { App, PluginSettingTab, Setting } from "obsidian";
import type HidePropertiesPlugin from "./main";

export interface HidePropertiesSettings {
    hiddenProperties: string[];
}

export const DEFAULT_SETTINGS: HidePropertiesSettings = {
    hiddenProperties: [],
};

export class HidePropertiesSettingTab extends PluginSettingTab {
    plugin: HidePropertiesPlugin;

    constructor(app: App, plugin: HidePropertiesPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        let saveDebounce: ReturnType<typeof setTimeout>;

        const setting = new Setting(containerEl)
            .setName("Hidden property names")
            .setDesc("One property name per line. These properties will be hidden behind a collapsible disclosure row in the properties panel.")
            .addTextArea((text) => {
                text
                    .setPlaceholder("calendar-id\nevent-id\ntimezone\ncreated\nupdated")
                    .setValue(this.plugin.settings.hiddenProperties.join("\n"))
                    .onChange((value) => {
                        // Update in memory immediately
                        this.plugin.settings.hiddenProperties = value
                            .split("\n")
                            .map((line) => line.trim())
                            .filter((line) => line.length > 0);
                        // Debounce the expensive disk write + DOM patch
                        clearTimeout(saveDebounce);
                        saveDebounce = setTimeout(async () => {
                            await this.plugin.saveSettings();
                            this.plugin.patchAllViews();
                        }, 400);
                    });
                text.inputEl.rows = 12;
            });

        // Stack the textarea below the name/description instead of beside it
        setting.settingEl.addClass("hide-properties-setting-stacked");
    }
}
