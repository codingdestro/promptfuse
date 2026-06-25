# Plan: Context Menu → Capture Selected Text → Create Prompt

## Summary

When a user right-clicks and selects "Create new prompt", capture any selected text and pre-fill the add-prompt modal with it. Works on **any page**, not just AI platforms. Preserves all existing injection/CRUD/import-export functionality.

## Design Decision

**Storage-based approach** (not message-passing to content script):

- Content script only runs on 4 AI platform URLs — message-passing wouldn't work on other pages
- Storage (`chrome.storage.local`) is accessible from both background and popup contexts
- Zero changes to content script or sites config

## Files to Change

**`background/background.js`** — Replace `tabs.sendMessage` with `storage.local.set`
**`popup/popup.js`** — Add pending-context check on popup open

## Files NOT to Change

- `content/injector.js` — untouched (existing INJECT_PROMPT flow preserved)
- `utils/sites.js` — untouched
- `db/db.js` — untouched
- `popup/popup.html` — untouched (modal already exists)
- `popup/popup.css` — untouched
- `manifest.json` — untouched (storage + contextMenus already in permissions)

---

## Step 1: background/background.js

**Replace the `onClicked` handler** (currently sends `OPEN_DIALOG` message to tab):

```javascript
const PENDING_KEY = "pendingContextData";

chrome.contextMenus.onClicked.addListener((info, _tab) => {
  if (info.menuItemId !== "open-dialog") return;

  const data = {
    selectedText: info.selectionText || "",
    capturedAt: Date.now(),
  };

  chrome.storage.local.set({ [PENDING_KEY]: data }, () => {
    if (chrome.runtime.lastError) {
      console.error("Failed to save context data:", chrome.runtime.lastError);
      return;
    }
    // Best-effort auto-open popup (works in Chrome MV3, no-ops in Firefox)
    if (typeof chrome.action?.openPopup === "function") {
      chrome.action.openPopup();
    }
  });
});
```

**Edge cases handled:**
- No text selected → `selectedText: ""` → modal opens with empty body (user just gets an empty add form)
- Rapid clicks → last click wins (each overwrites previous)
- Storage write fails → error logged, no popup, nothing breaks

---

## Step 2: popup/popup.js

**Add new function** (before the DOMContentLoaded listener):

```javascript
function checkPendingContextData() {
  const PENDING_KEY = "pendingContextData";
  const MAX_AGE = 5 * 60 * 1000; // 5 minutes

  chrome.storage.local.get(PENDING_KEY, (result) => {
    if (chrome.runtime.lastError) return;

    const data = result[PENDING_KEY];
    if (!data) return;

    // Clear immediately to prevent re-use
    chrome.storage.local.remove(PENDING_KEY);

    // Discard if stale (>5 min old)
    const age = Date.now() - (data.capturedAt || 0);
    if (age > MAX_AGE) return;

    // Open the add modal (resets all fields to empty)
    openAddModal();
    // Pre-fill body with selected text
    fieldBody.value = data.selectedText || "";
  });
}
```

**Add call** at the end of the DOMContentLoaded callback:

```javascript
  // Restore state and init
  restoreFilterState();
  checkPendingContextData();  // <-- add this line
});
```

**Why `openAddModal()` first?** It resets `fieldBody.value = ""`, then we overwrite it. This keeps all other fields (title, category, tags) clean — only the body gets the selected text.

**Edge cases handled:**
- No pending data → returns silently → normal popup behavior
- Stale data (>5 min) → silently cleared → normal popup behavior
- Valid data → modal auto-opens with selected text in body
- User clicks "Add Prompt" manually → works exactly as before (no interference)

---

## Verification

### Manual tests

1. **No selection**: Right-click on any page → "Create new prompt" → popup opens → modal is open with empty body
2. **With selection**: Select text on any page → right-click → "Create new prompt" → popup opens → modal is open with selected text in body
3. **Staleness**: Select text → context menu → wait 6 min → open popup → modal NOT auto-opened (normal popup)
4. **Existing inject**: Go to ChatGPT → Inject a prompt → text appears in chat input
5. **Existing CRUD**: Add/edit/delete/import/export prompts → all work as before

### Regression check points

- `injector.js`: Zero changes confirmed
- `sites.js`: Zero changes confirmed
- `popup.html`: Zero changes confirmed
- `manifest.json`: Zero changes confirmed
- `INJECT_PROMPT` flow: Unchanged — `tabs.sendMessage` in `injectPrompt()` is untouched
