# Hide Properties

An [Obsidian](https://obsidian.md) plugin that lets you define a vault-wide list of frontmatter property names to hide from the properties panel. Hidden properties are tucked behind a collapsible disclosure row in every note — without deleting them or making them unqueryable.

## What it does

Properties you designate as hidden are moved out of the main view and tucked behind a **▶ Hidden (N)** row at the bottom of the properties panel. Click it to expand and see them; click again to collapse.

Hidden properties:
- Are **not deleted** from the file's YAML frontmatter
- Remain **fully queryable** by Dataview, Search, and other plugins
- Are **editable** when expanded, just like any normal property
- Can be **hidden or unhidden** per-property via right-click without going to settings

## Demo

```
┌─────────────────────────────────────────┐
│ title        My Meeting                 │
│ date         2026-03-02                 │
│ start-time   9:00 AM                    │
│ status       confirmed                  │
│ ─────────────────────────────────────── │
│ ▶ Hidden (6)                            │
└─────────────────────────────────────────┘
```

After clicking **▶ Hidden (6)**:

```
┌─────────────────────────────────────────┐
│ title        My Meeting                 │
│ date         2026-03-02                 │
│ start-time   9:00 AM                    │
│ status       confirmed                  │
│ ─────────────────────────────────────── │
│ ▼ Hidden (6)                            │
│   calendar-id   abc123@group.calendar…  │
│   event-id      5jis7l4n1qt18kdgc9r…   │
│   timezone      America/Denver          │
│   created       2026-03-01T…            │
│   updated       2026-03-02T…            │
│   organizer     user@example.com        │
└─────────────────────────────────────────┘
```

## Installation

### From the Obsidian community plugins directory (coming soon)

1. Open **Settings → Community plugins**
2. Disable Safe mode if prompted
3. Click **Browse** and search for "Hide Properties"
4. Click **Install**, then **Enable**

### Manual installation

1. Download the [latest release](../../releases/latest) and extract it
2. Copy `main.js`, `manifest.json`, and `styles.css` into your vault at `.obsidian/plugins/hide-properties/`
3. Reload Obsidian and enable the plugin under **Settings → Community plugins**

## Usage

### Configuring hidden properties

Go to **Settings → Hide Properties** and enter the property names you want to hide, one per line:

```
calendar-id
event-id
timezone
created
updated
organizer
```

This list is **vault-wide** — any note that contains a listed property will have it hidden. Changes apply immediately to all open notes.

### Hiding / unhiding via right-click

Right-click the drag handle (≡) on any property row to get the standard Obsidian property menu with an added **Hide property** or **Unhide property** item at the bottom.

## Compatibility

- Requires Obsidian **1.4.0** or later (properties panel)
- Works in both light and dark themes
- Desktop and mobile compatible

## Development

```bash
# Install dependencies
npm install

# Build (production)
npm run build

# Watch mode (development)
npm run dev
```

Symlink the plugin directory into your vault for live development:

```bash
ln -s /path/to/ObsidianHidePropertiesPlugin/main.js \
      /path/to/vault/.obsidian/plugins/hide-properties/main.js
ln -s /path/to/ObsidianHidePropertiesPlugin/manifest.json \
      /path/to/vault/.obsidian/plugins/hide-properties/manifest.json
ln -s /path/to/ObsidianHidePropertiesPlugin/styles.css \
      /path/to/vault/.obsidian/plugins/hide-properties/styles.css
```

## License

[MIT](LICENSE)
