# PromptVault

A Firefox browser extension that lets you store, organize, and inject reusable AI prompts directly into chat platforms — ChatGPT, Claude, DeepSeek, and Gemini. Prompts are saved locally in IndexedDB with full CRUD, search, category sorting, favorites, and import/export.

## Screenshots

- **Popup overview** – Show the prompt list with search, category filter, and sort controls.
- **Add prompt modal** – The "Add Prompt" form with title, category, body, tags, and favorite toggle.
- **Injected prompt** – A prompt card's Inject button was clicked and the text appeared in a chat platform's input field.
- **Import/export** – Settings menu with Export and Import options.

## Installation

### Temporary load (development)

1. Open Firefox and navigate to `about:debugging`
2. Click **This Firefox** → **Load Temporary Add-on**
3. Select `manifest.json` from the extracted build folder or zip
4. The PromptVault icon appears in the toolbar

### Permanent install (future)

Once submitted to AMO, install directly from `addons.mozilla.org`.

## Supported platforms

- ChatGPT (`chat.openai.com`)
- Claude (`claude.ai`)
- DeepSeek (`chat.deepseek.com`)
- Gemini (`gemini.google.com`)

## Usage

1. Click the PromptVault toolbar icon to open the popup
2. Click **+ Add Prompt** to create a new prompt
3. Browse your library, search by keyword, or filter by category and favorites
4. Navigate to a supported AI chat platform
5. Click **Inject** on any prompt card — the text is inserted into the chat input for review before sending

### Sorting

- **Newest first** / **Oldest first** – by creation date
- **Most used** – by injection count
- **A → Z** – alphabetical by title

### Import / Export

Click the settings gear icon to access Import (select a `.json` file) and Export (downloads your entire prompt library as JSON).

## Development

No build step required. Edit any file directly and reload the extension in `about:debugging`.

### Package for distribution

```bash
npx web-ext build --source-dir . --artifacts-dir ./dist
```

The output zip in `dist/` can be submitted to AMO.

## Project structure

```
promptvault/
├── manifest.json         # Extension manifest (MV3)
├── background/
│   └── background.js     # Service worker
├── content/
│   └── injector.js       # Content script — prompt injection
├── db/
│   └── db.js             # IndexedDB wrapper — all CRUD operations
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
├── popup/
│   ├── popup.html        # Popup UI markup
│   ├── popup.css         # Popup styles (dark theme)
│   └── popup.js          # Popup logic — rendering, modal, inject flow
└── utils/
    └── sites.js          # Platform-specific DOM selectors
```
