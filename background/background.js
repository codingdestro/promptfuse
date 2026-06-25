// TODO: implement in T-02+

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "open-dialog",
    title: "Create new prompt",
    contexts: ["all"],
  });
});

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
