# PrompFuse— Firefox Extension

## Agent Task List

> **Agent briefing:** You are building a Firefox browser extension called **PromptFuse**. It lets users store, organize, and inject reusable AI prompts directly into chat platforms (ChatGPT, Claude, DeepSeek, Gemini). Storage is IndexedDB. UI is a browser action popup. Injection is done via content scripts. Work through tasks in phase order. Each task includes its goal, inputs, expected outputs, and done criteria. Do not skip tasks — later phases depend on earlier ones.

---

## How to read this file

Each task block follows this structure:

```
### T-XX — Task Name
GOAL:    What this task achieves and why it matters.
INPUT:   Files, data, or context you need before starting.
OUTPUT:  Exactly what you must produce (files, exports, side effects).
NOTES:   Constraints, edge cases, or decisions pre-made for you.
DONE:    Verifiable acceptance criteria. Check every item before marking complete.
```

Mark tasks `[x]` only when every DONE criterion is met. Never mark done speculatively.

---

## Phase 1 — Scaffold

> Goal: Establish the full folder structure and a valid, loadable `manifest.json`. Nothing runs yet, but Firefox should accept the extension without errors.

---

### T-01 — Create folder structure

```
GOAL:    Create the canonical project layout all future tasks will write into.
INPUT:   Nothing. This is the starting point.
OUTPUT:  The following empty files and directories on disk:
           promptfuse/
           ├── manifest.json          ← to be filled in T-02
           ├── background/
           │   └── background.js      ← empty
           ├── popup/
           │   ├── popup.html         ← empty
           │   ├── popup.css          ← empty
           │   └── popup.js           ← empty
           ├── content/
           │   └── injector.js        ← empty
           ├── db/
           │   └── db.js              ← empty
           ├── utils/
           │   └── sites.js           ← empty
           └── icons/
               └── .gitkeep           ← placeholder; real icons added in T-03
NOTES:   Use stub comments in each .js file: // TODO: implement in T-XX
DONE:
  [ ] All paths above exist on disk
  [ ] No files contain implementation code yet
```

---

### T-02 — Write manifest.json

```
GOAL:    Produce a valid MV3 manifest that Firefox accepts when loaded via about:debugging.
INPUT:   T-01 completed (folder exists).
OUTPUT:  promptfuse/manifest.json with all fields below.
NOTES:
  - manifest_version: 3
  - name: "PromptFuse"
  - version: "1.0.0"
  - description: "Store, organize, and inject reusable prompts into AI chat platforms."
  - permissions: ["storage", "activeTab", "scripting"]
  - host_permissions: cover these exact origins:
      https://chat.openai.com/*
      https://claude.ai/*
      https://chat.deepseek.com/*
      https://gemini.google.com/*
  - background.service_worker: "background/background.js"
  - content_scripts: one entry matching all host_permissions URLs,
      js: ["content/injector.js"], run_at: "document_idle"
  - action.default_popup: "popup/popup.html"
  - action.default_icon: { "48": "icons/icon-48.png" }
  - icons: { "16": "icons/icon-16.png", "48": "icons/icon-48.png", "128": "icons/icon-128.png" }
DONE:
  [ ] manifest.json is valid JSON (no parse errors)
  [ ] All four AI platform origins are in host_permissions
  [ ] background, content_scripts, and action are all registered
  [ ] Loading the extension in Firefox produces no manifest errors
```

---

### T-03 — Generate placeholder icons

```
GOAL:    Provide the three PNG icons declared in manifest.json so Firefox doesn't throw
         missing-file errors on load.
INPUT:   manifest.json (T-02) specifying icon paths.
OUTPUT:  icons/icon-16.png, icons/icon-48.png, icons/icon-128.png
         Each is a simple solid-color square with a "P" letter glyph, sized exactly
         16×16, 48×48, and 128×128 pixels respectively.
NOTES:   Use a Canvas-based Node script or Python (Pillow) to generate them programmatically.
         Do not source external images.
DONE:
  [ ] All three PNG files exist and are valid (not 0 bytes)
  [ ] Each file is the correct pixel dimension
  [ ] Extension loads in Firefox without icon-related console errors
```

---

## Phase 2 — Database Layer

> Goal: Build a self-contained IndexedDB module (`db/db.js`) that every other script will import. All data access must go through this module — never raw `indexedDB` calls outside it.

---

### T-04 — Define DB schema and open connection

```
GOAL:    Implement the DB open/upgrade logic with the correct object store and indexes.
INPUT:   db/db.js (currently empty).
OUTPUT:  db/db.js containing:
           - DB_NAME = "PromptFuseDB", DB_VERSION = 1
           - openDB() → returns a Promise<IDBDatabase>
           - Object store "prompts" with keyPath "id", autoIncrement: true
           - Indexes:
               "by_category"   on "category",    unique: false
               "by_favorite"   on "isFavorite",  unique: false
               "by_usage"      on "usageCount",  unique: false
               "by_created"    on "createdAt",   unique: false
NOTES:
  - Wrap all IDBRequest callbacks in Promises (no raw onsuccess/onerror in callers).
  - openDB() must be idempotent — safe to call multiple times; reuse the same connection.
  - Schema for each record:
      {
        id:          number (auto),
        title:       string,       // required
        body:        string,       // required — the prompt text
        category:    string,       // e.g. "Coding", "Writing"
        tags:        string[],     // optional free-form tags
        isFavorite:  boolean,      // default false
        usageCount:  number,       // default 0
        createdAt:   number,       // Date.now() at insert
        updatedAt:   number        // Date.now() at insert and each update
      }
DONE:
  [ ] openDB() resolves without error in a browser context
  [ ] Object store "prompts" and all four indexes exist after upgrade
  [ ] Calling openDB() twice returns the same connection, not two separate opens
```

---

### T-05 — Implement CRUD functions

```
GOAL:    Expose the full data-access API that popup.js and background.js will call.
INPUT:   T-04 complete (openDB works).
OUTPUT:  The following async functions exported from db/db.js:

  getAllPrompts()
    → Promise<Prompt[]>   all records, no filter

  getPromptsByCategory(category: string)
    → Promise<Prompt[]>   uses "by_category" index

  addPrompt(fields: Omit<Prompt, 'id'|'createdAt'|'updatedAt'>)
    → Promise<number>     returns new record id
    sets createdAt and updatedAt to Date.now()

  updatePrompt(id: number, fields: Partial<Prompt>)
    → Promise<void>       merges fields, refreshes updatedAt

  deletePrompt(id: number)
    → Promise<void>

  incrementUsage(id: number)
    → Promise<void>       increments usageCount by 1, refreshes updatedAt

  searchPrompts(query: string)
    → Promise<Prompt[]>   client-side filter: case-insensitive match in
                          title, body, or any element of tags[]

  getAllCategories()
    → Promise<string[]>   unique, sorted category values derived from all records

NOTES:
  - Use IDBKeyRange and index.getAll() where applicable; fall back to cursor only if needed.
  - searchPrompts must not be backed by an index — it's a full-scan filter.
  - Every function must reject (not silently swallow) IDB errors.
DONE:
  [ ] All eight functions are exported
  [ ] addPrompt round-trips: add then getAllPrompts returns the record
  [ ] updatePrompt only modifies specified fields; unspecified fields unchanged
  [ ] deletePrompt removes the record; subsequent getAllPrompts does not include it
  [ ] searchPrompts("code") returns records whose title/body/tags contain "code" (case-insensitive)
  [ ] getAllCategories returns sorted unique values with no duplicates
```

---

## Phase 3 — Popup UI

> Goal: Build the full popup interface. The popup must be functional and visually complete. It communicates with `db.js` directly (same extension context) and sends messages to the content script for injection.

---

### T-06 — Popup HTML skeleton

```
GOAL:    Write the full static HTML structure for popup.html. No logic yet — just markup.
INPUT:   T-01 (popup/ folder exists), design spec below.
OUTPUT:  popup/popup.html with these regions:

  <header>
    - Extension name "PromptFuse" as h1
    - "+ Add Prompt" button  (id="btn-add")
    - Settings gear icon button (id="btn-settings")

  <section id="controls">
    - Text input for search (id="search-input", placeholder="Search prompts…")
    - "×" clear button next to search (id="btn-clear-search"), hidden by default
    - Category <select> (id="filter-category"), first option: "All Categories"
    - Sort <select> (id="sort-order") with options:
        value="newest"    label="Newest first"  (default selected)
        value="oldest"    label="Oldest first"
        value="most-used" label="Most used"
        value="az"        label="A → Z"
    - Favorites toggle button (id="btn-favorites"), aria-pressed="false"

  <section id="prompt-list-wrap">
    - <ul id="prompt-list"> — will be populated by popup.js
    - <div id="empty-state" hidden>
        Icon placeholder + "No prompts yet." + "Add your first prompt →" button

  <div id="modal" role="dialog" aria-modal="true" hidden>
    — Add/Edit form (detailed in T-08)

  <div id="toast" aria-live="polite" hidden>
    — Single toast container

NOTES:
  - Link popup.css and popup.js via <link> and <script defer>.
  - No inline styles. No inline event handlers.
  - All interactive elements must have accessible labels (aria-label or visible text).
DONE:
  [ ] HTML is valid (no parse errors)
  [ ] All IDs listed above exist exactly once
  [ ] popup.html opens in browser without layout errors (can be verified by opening as file)
```

---

### T-07 — Popup CSS

```
GOAL:    Style the popup. Match the dark AI-tool aesthetic. Pixel-perfect at 380×560px.
INPUT:   popup.html (T-06).
OUTPUT:  popup/popup.css

  Token system (define as CSS custom properties on :root):
    --bg-base:      #0f1117    deep near-black
    --bg-surface:   #1a1d27    card/input background
    --bg-hover:     #22263a    card hover state
    --accent:       #7c6af7    violet — primary action color
    --accent-hover: #6a58e0
    --text-primary: #e8e9f0
    --text-muted:   #7a7d96
    --danger:       #e05c5c
    --success:      #4caf7d
    --radius:       8px
    --transition:   150ms ease

  Layout rules:
    - body: width 380px, height 560px, overflow hidden, flex column
    - header: flex row, space-between, padding 12px 16px, border-bottom 1px solid #ffffff10
    - #controls: padding 10px 16px, flex column, gap 8px
    - #prompt-list-wrap: flex 1, overflow-y auto, padding 0 16px 12px
    - #prompt-list: list-style none, flex column, gap 8px, margin 0, padding 0

  Prompt card (.prompt-card):
    - background var(--bg-surface), border-radius var(--radius)
    - padding 12px 14px
    - hover: background var(--bg-hover), transition var(--transition)
    - .card-title: font-weight 600, color var(--text-primary), white-space nowrap,
      overflow hidden, text-overflow ellipsis, max-width 200px
    - .card-category: badge pill, small font, accent color background at 20% opacity,
      accent color text
    - .card-preview: font-size 12px, color var(--text-muted), max 2 lines,
      -webkit-line-clamp 2
    - .card-actions: flex row, gap 6px, margin-top 8px
    - .btn-inject: primary button — accent bg, white text, small, border-radius 6px
    - .btn-edit, .btn-delete: icon-only ghost buttons, muted color, hover colored

  Modal (#modal):
    - position absolute, inset 0, background #000000cc (backdrop)
    - inner .modal-box: background var(--bg-surface), border-radius 12px,
      margin 20px 16px, padding 20px, flex column, gap 14px
    - form inputs/textareas: full width, bg var(--bg-base), border 1px solid #ffffff15,
      border-radius var(--radius), color var(--text-primary), padding 8px 12px
    - textarea#prompt-body: min-height 120px, resize vertical

  Toast (#toast):
    - position absolute, bottom 16px, left 50%, transform translateX(-50%)
    - padding 8px 18px, border-radius 20px, font-size 13px, white-space nowrap
    - &.success: background var(--success)
    - &.error:   background var(--danger)

DONE:
  [ ] All CSS custom properties defined on :root
  [ ] popup renders at exactly 380×560px with no scrollbar on the outer body
  [ ] Cards truncate long titles without breaking layout
  [ ] Modal backdrop covers full popup area
  [ ] No hardcoded hex values outside the :root token block
```

---

### T-08 — Add / Edit prompt modal

```
GOAL:    Implement the modal form markup (inside #modal in popup.html) and its
         open/close/submit logic in popup.js.
INPUT:   popup.html (T-06), popup.css (T-07).
OUTPUT:
  popup.html — fill #modal with:
    <div class="modal-box">
      <h2 id="modal-title">Add Prompt</h2>
      <label>Title <input id="field-title" type="text" maxlength="100" required></label>
      <label>Category
        <input id="field-category" type="text" list="category-list">
        <datalist id="category-list"></datalist>
      </label>
      <label>Prompt
        <textarea id="field-body" required></textarea>
      </label>
      <label>Tags (comma-separated)
        <input id="field-tags" type="text" placeholder="coding, refactor, review">
      </label>
      <label class="checkbox-row">
        <input id="field-favorite" type="checkbox"> Favorite
      </label>
      <div class="modal-actions">
        <button id="btn-modal-cancel">Cancel</button>
        <button id="btn-modal-save">Save</button>
      </div>
    </div>

  popup.js — implement:
    openAddModal()
      - Set modal-title to "Add Prompt"
      - Clear all fields
      - Populate #category-list datalist from getAllCategories()
      - Remove hidden from #modal, focus #field-title

    openEditModal(prompt)
      - Set modal-title to "Edit Prompt"
      - Pre-fill all fields from prompt object
      - Populate datalist
      - Store prompt.id in a module-level editingId variable
      - Remove hidden from #modal

    closeModal()
      - Add hidden to #modal
      - Reset editingId to null

    handleModalSave()
      - Validate: title and body must be non-empty; show inline error if not
      - Parse tags: split by comma, trim, filter empty strings
      - If editingId is set: call updatePrompt(editingId, fields)
      - Else: call addPrompt(fields)
      - On success: closeModal(), refreshList()
      - On error: show toast("Save failed", "error")

NOTES:
  - Wire btn-modal-cancel → closeModal()
  - Wire btn-modal-save → handleModalSave()
  - Clicking the backdrop (not .modal-box) also closes the modal
DONE:
  [ ] "Add Prompt" button opens modal with empty fields
  [ ] Clicking edit on a card opens modal pre-filled with that prompt's data
  [ ] Saving a new prompt adds it to the DB and it appears in the list immediately
  [ ] Saving an edit updates the existing record (same id, updated fields)
  [ ] Cancel or backdrop click closes without saving
  [ ] Empty title or body shows a visible validation error, does not submit
```

---

### T-09 — Prompt list rendering and interactions

```
GOAL:    Implement the core list render loop and all card interactions in popup.js.
INPUT:   db.js (T-05), popup.html (T-06), popup.css (T-07).
OUTPUT:  popup.js functions:

  renderList(prompts: Prompt[])
    - Clear #prompt-list
    - If prompts is empty: show #empty-state, hide #prompt-list
    - Else: hide #empty-state, render one <li class="prompt-card"> per prompt:
        - .card-title (with overflow ellipsis)
        - .card-category badge (skip if category is empty string)
        - .card-preview (first 120 chars of body)
        - ★ favorite indicator (filled if isFavorite)
        - Buttons: Inject, Edit, Delete
        - Wire Edit → openEditModal(prompt)
        - Wire Delete → confirmDelete(promptId)
        - Wire Inject → injectPrompt(prompt)

  confirmDelete(id)
    - Replace the card's action buttons with inline "Delete? [Yes] [No]"
    - [Yes]: call deletePrompt(id), refreshList(), show toast "Deleted"
    - [No]: restore original buttons
    - Auto-restore after 3 seconds if no action taken

  refreshList()
    - Read current values of search input, category select, sort select,
      and favorites toggle
    - Fetch from DB using the appropriate db.js function
    - Apply client-side search filter if search query is non-empty
    - Apply sort:
        newest    → sort by createdAt desc
        oldest    → sort by createdAt asc
        most-used → sort by usageCount desc
        az        → sort by title asc (localeCompare)
    - Call renderList(results)
    - Update result count label: "Showing N of Total"

  Initialization on DOMContentLoaded:
    - Call refreshList()
    - Wire search input → debounced (200ms) refreshList()
    - Wire btn-clear-search → clear input, refreshList()
    - Wire filter-category change → refreshList()
    - Wire sort-order change → refreshList()
    - Wire btn-favorites toggle → toggle aria-pressed, refreshList()
    - Wire btn-add → openAddModal()
    - Restore last filter/sort state from chrome.storage.session on load
    - Save filter/sort state to chrome.storage.session on each change

NOTES:
  - Do not use innerHTML with unsanitized prompt content. Use
    textContent / createElement to build card DOM safely.
  - The search clear button (×) should be visible only when the input is non-empty.
DONE:
  [ ] List renders all prompts on popup open
  [ ] Search filters live as user types (debounced)
  [ ] Category dropdown populates from real DB data
  [ ] All four sort modes produce correctly ordered results
  [ ] Favorites toggle shows only favorited prompts when active
  [ ] Delete inline confirmation appears; Yes removes the card; No restores it
  [ ] Filter/sort selections persist across popup open/close (session storage)
  [ ] Result count label is accurate
```

---

## Phase 4 — Injection

> Goal: Implement the content script that receives a prompt text and inserts it into the active AI chat platform's input field.

---

### T-10 — Site selector map

```
GOAL:    Define the platform-specific DOM selectors in one place so injector.js
         and any future scripts can import them without hardcoding.
INPUT:   utils/sites.js (currently empty).
OUTPUT:  utils/sites.js exporting:

  export const SITE_CONFIG = {
    "chat.openai.com": {
      name: "ChatGPT",
      inputSelector: "#prompt-textarea",
      inputType: "textarea",        // "textarea" | "contenteditable"
      submitSelector: "[data-testid='send-button']"
    },
    "claude.ai": {
      name: "Claude",
      inputSelector: ".ProseMirror[contenteditable='true']",
      inputType: "contenteditable",
      submitSelector: "button[aria-label='Send message']"
    },
    "chat.deepseek.com": {
      name: "DeepSeek",
      inputSelector: "textarea#chat-input",
      inputType: "textarea",
      submitSelector: "button.send-btn"
    },
    "gemini.google.com": {
      name: "Gemini",
      inputSelector: "rich-textarea .ql-editor",
      inputType: "contenteditable",
      submitSelector: "button.send-button"
    }
  };

NOTES:
  - All selectors are best-effort at time of writing. The agent must not change
    selector values without a comment noting they were verified manually.
  - inputType drives the injection strategy in T-11.
DONE:
  [ ] File exports SITE_CONFIG as a named export
  [ ] All four platforms are present
  [ ] Each entry has name, inputSelector, inputType, submitSelector
```

---

### T-11 — Content script injection logic

```
GOAL:    Implement the content script that listens for INJECT_PROMPT messages
         and inserts the prompt text into the platform's chat input.
INPUT:   utils/sites.js (T-10), content/injector.js (currently empty).
OUTPUT:  content/injector.js implementing:

  Lookup:
    - Derive hostname from window.location.hostname
    - Look up config from SITE_CONFIG
    - If hostname not found in SITE_CONFIG: ignore (do not error)

  Message listener (chrome.runtime.onMessage):
    Message type "INJECT_PROMPT", payload { text: string }:

    1. Find the input element using config.inputSelector
       - If not found after one retry (100ms wait): send response
         { success: false, reason: "INPUT_NOT_FOUND" } and return

    2. Inject text based on config.inputType:
       "textarea":
         - element.value = text
         - Dispatch new Event("input", { bubbles: true })
         - Dispatch new Event("change", { bubbles: true })
       "contenteditable":
         - element.focus()
         - document.execCommand("selectAll")
         - document.execCommand("insertText", false, text)
         - If execCommand unavailable: set element.textContent = text,
           then dispatch InputEvent("input", { bubbles: true, inputType: "insertText", data: text })

    3. Focus the element

    4. Send response { success: true, platform: config.name }

  Return true from the listener to keep the message channel open for async response.

NOTES:
  - Do NOT auto-submit. The user reviews and sends manually.
  - React/Vue-driven inputs require the synthetic event dispatch to register the value.
  - The content script runs at document_idle but the user may open the popup before
    the SPA has rendered its input — the 100ms retry handles this gracefully.
DONE:
  [ ] On a supported platform, INJECT_PROMPT inserts text into the input
  [ ] On an unsupported URL, the message is silently ignored
  [ ] Input element receives focus after injection
  [ ] React state updates (ChatGPT and Claude) accept the injected text
    (the send button becomes active)
  [ ] Response object is always sent (no silent failures)
```

---

## Phase 5 — Popup ↔ Content Script Communication

---

### T-12 — Inject flow in popup.js

```
GOAL:    Wire the Inject button in popup.js to send INJECT_PROMPT to the content
         script and handle the response.
INPUT:   popup.js (T-09), injector.js (T-11).
OUTPUT:  popup.js — add function:

  async injectPrompt(prompt)
    1. Query active tab: chrome.tabs.query({ active: true, currentWindow: true })
    2. Check tab.url against SITE_CONFIG keys:
       - If no match: showToast("Open a supported AI chat platform first", "error"); return
    3. Send message { type: "INJECT_PROMPT", text: prompt.body } to tab
       via chrome.tabs.sendMessage
    4. On response:
       - success true:  incrementUsage(prompt.id), refreshList(),
                        showToast(`Injected into ${response.platform}`, "success")
       - success false: showToast(`Injection failed: ${response.reason}`, "error")
    5. On chrome.runtime.lastError (content script not ready):
       showToast("Could not reach the page. Reload and try again.", "error")

  showToast(message, type)  ["success" | "error"]
    - Set #toast textContent, remove hidden, add class type
    - After 2500ms: add hidden, remove class type

NOTES:
  - chrome.tabs.sendMessage may throw if the content script hasn't loaded yet.
    Wrap in try/catch and surface as a toast, not a console error.
  - Import SITE_CONFIG from utils/sites.js to check URL support client-side
    before even sending the message.
DONE:
  [ ] Clicking Inject on a card when on ChatGPT/Claude/DeepSeek/Gemini inserts text
  [ ] Success toast shows the platform name
  [ ] Error toast shows if the tab is not a supported platform
  [ ] usageCount increments in DB after successful injection
  [ ] "Most used" sort reflects updated usageCount immediately after inject
```

---

## Phase 6 — Import / Export

---

### T-13 — Export all prompts

```
GOAL:    Let users back up their prompt library as a JSON file.
INPUT:   db.js (T-05), popup.html (T-06).
OUTPUT:
  popup.html — add "Export" button to settings panel or header overflow menu
  popup.js — implement exportPrompts():
    1. Call getAllPrompts()
    2. Serialize to JSON with 2-space indent
    3. Wrap in Blob({ type: "application/json" })
    4. Create an <a> with download="promptfuse-YYYY-MM-DD.json"
    5. Programmatically click it, then revoke the object URL
DONE:
  [ ] Clicking Export downloads a .json file
  [ ] Filename contains today's date
  [ ] JSON is valid and contains all prompts
  [ ] File can be re-imported in T-14 without loss
```

---

### T-14 — Import prompts from JSON

```
GOAL:    Let users restore or merge a previously exported prompt library.
INPUT:   db.js (T-05), popup.html (T-06).
OUTPUT:
  popup.html — add "Import" file input (accept=".json") in settings panel
  popup.js — implement importPrompts(file):
    1. Read file as text via FileReader
    2. JSON.parse — on error: showToast("Invalid JSON file", "error"); return
    3. Validate structure: must be an array; each item must have title (string)
       and body (string); skip malformed records, count them as "skipped"
    4. Fetch existing titles via getAllPrompts() → build a Set of existing titles
    5. For each valid incoming record:
       - If title already exists in Set: increment skippedCount
       - Else: call addPrompt(record fields), increment importedCount
    6. refreshList()
    7. showToast(`Imported ${importedCount}, skipped ${skippedCount}`, "success")
NOTES:
  - Do not replace all data. Merge only — never delete existing prompts during import.
  - Tags must be imported as string[] — if the JSON has tags as a string,
    split by comma.
DONE:
  [ ] Selecting a valid export file imports all new prompts
  [ ] Prompts with duplicate titles are skipped, not duplicated
  [ ] Toast shows accurate imported/skipped counts
  [ ] Malformed records are skipped without crashing the import
  [ ] Import round-trip: export → clear DB manually → import → all prompts restored
```

---

## Phase 7 — QA Checklist

> Run through every item below before considering the extension shippable. Fix any failures before marking done.

---

### T-15 — Functional QA

```
GOAL:    Verify end-to-end functionality across all four platforms and all UI states.
INPUT:   All phases complete.
OUTPUT:  This checklist fully checked. File a bug comment for any failure.

Platform injection:
  [ ] ChatGPT: inject populates textarea and send button activates
  [ ] Claude: inject populates contenteditable and send button activates
  [ ] DeepSeek: inject populates textarea and send button activates
  [ ] Gemini: inject populates contenteditable and send button activates

Data integrity:
  [ ] Adding a prompt persists across popup close and reopen
  [ ] Editing a prompt updates content and updatedAt timestamp
  [ ] Deleting a prompt removes it from all views
  [ ] usageCount increments exactly once per successful inject
  [ ] IndexedDB data survives browser restart

UI edge cases:
  [ ] Empty state shows when DB is empty
  [ ] Search with no results shows "Showing 0 of N" and empty list (not empty-state)
  [ ] Prompt with no category renders without a broken badge
  [ ] 100+ prompts: list scrolls without jank
  [ ] Very long prompt body (5000+ chars): preview truncates, inject sends full text
  [ ] Unicode / Arabic / Devanagari text in title/body: search and render correct

Filter/sort:
  [ ] All four sort modes produce correct ordering
  [ ] Category filter shows only prompts in that category
  [ ] Favorites toggle shows only favorited prompts
  [ ] Combined filter (category + favorites + search) intersects all three correctly
  [ ] Session storage restores last filter/sort state on popup reopen

Import/export:
  [ ] Export produces a valid, parseable JSON file
  [ ] Import merges without duplicating existing prompts
  [ ] Import skips and counts malformed records
```

---

### T-16 — Security & CSP audit

```
GOAL:    Ensure the extension passes Mozilla's content security policy requirements
         and does not introduce XSS or data-leak vectors.
INPUT:   All source files.
OUTPUT:  No changes needed if clean; otherwise patched source files.

  [ ] No inline event handlers anywhere in HTML (no onclick="...", onchange="...")
  [ ] No use of eval(), new Function(), or innerHTML with user-supplied content
  [ ] All DOM construction for prompt content uses createElement / textContent
  [ ] manifest.json does not declare content_security_policy broader than default
  [ ] host_permissions are scoped to exact origins, not https://*/*
  [ ] No network requests made by the extension (all data is local IndexedDB)
  [ ] chrome.storage.session is used only for UI preferences, not prompt data
```

---

## Phase 8 — Distribution

---

### T-17 — Package and prepare for AMO submission

```
GOAL:    Produce a submission-ready zip and store listing assets.
INPUT:   All phases complete and QA passing (T-15, T-16).
OUTPUT:
  - Run: web-ext build --source-dir ./promptfuse --artifacts-dir ./dist
    → produces dist/promptfuse-1.0.0.zip
  - Write README.md at repo root:
      - One-paragraph description
      - Screenshot placeholder notes (agent: list what each screenshot should show)
      - Installation instructions (temporary load via about:debugging)
      - Supported platforms list
  - Verify zip loads cleanly as a temporary add-on in Firefox (about:debugging →
    Load Temporary Add-on → select manifest.json from extracted zip)

NOTES:
  - AMO requires source code submission for any minified or bundled files.
    Since this project has no build step, the source zip IS the submission artifact.
DONE:
  [ ] web-ext build completes without warnings
  [ ] Zip loads in Firefox without errors
  [ ] README.md exists and is accurate
  [ ] Extension icon appears in the Firefox toolbar
```

---

## Appendix — Tech Decisions (reference only, do not re-litigate)

| Concern                 | Decision                               | Reason                                                                                   |
| ----------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Manifest                | V3                                     | Required for new AMO submissions                                                         |
| Storage                 | Raw IndexedDB, no wrapper              | Zero dependencies; IndexedDB is sufficient for this schema                               |
| UI framework            | Vanilla JS + CSS                       | Keeps bundle tiny; no transpile step; easier to audit                                    |
| Build tool              | `web-ext` for packaging only           | No bundler needed since no imports cross extension contexts                              |
| Extension API namespace | `chrome.*`                             | Firefox supports the `chrome` namespace alias; compatible with Chrome if needed          |
| Injection strategy      | Message passing popup → content script | Popup and content script run in different contexts; direct DOM access requires messaging |
| Auto-submit             | Off, not configurable in v1            | Injecting and auto-sending without review is a UX anti-pattern for prompts               |
