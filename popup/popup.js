/* global db, SITE_CONFIG */

let editingId = null;
let debounceTimer = null;

// ── DOM refs ──
const $ = (id) => document.getElementById(id);

const searchInput = $("search-input");
const btnClearSearch = $("btn-clear-search");
const filterCategory = $("filter-category");
const sortOrder = $("sort-order");
const btnFavorites = $("btn-favorites");
const promptList = $("prompt-list");
const emptyState = $("empty-state");
const btnEmptyAdd = $("btn-empty-add");
const resultCount = $("result-count");
const modal = $("modal");
const modalTitle = $("modal-title");
const fieldTitle = $("field-title");
const fieldCategory = $("field-category");
const fieldBody = $("field-body");
const fieldTags = $("field-tags");
const fieldFavorite = $("field-favorite");
const categoryList = $("category-list");
const btnModalCancel = $("btn-modal-cancel");
const btnModalSave = $("btn-modal-save");
const modalError = $("modal-error");
const toast = $("toast");
const btnAdd = $("btn-add");
const btnExport = $("btn-export");
const importInput = $("import-input");

// ── State persistence ──
function saveFilterState() {
  chrome.storage.session.set({
    filterCategory: filterCategory.value,
    sortOrder: sortOrder.value,
    favoritesOnly: btnFavorites.getAttribute("aria-pressed") === "true",
    searchQuery: searchInput.value,
  });
}

function restoreFilterState() {
  chrome.storage.session.get(
    ["filterCategory", "sortOrder", "favoritesOnly", "searchQuery"],
    (result) => {
      if (result.filterCategory) filterCategory.value = result.filterCategory;
      if (result.sortOrder) sortOrder.value = result.sortOrder;
      if (result.favoritesOnly === true)
        btnFavorites.setAttribute("aria-pressed", "true");
      if (result.searchQuery) searchInput.value = result.searchQuery;
      btnClearSearch.hidden = !searchInput.value;
      refreshList();
    },
  );
}

// ── Toast ──
function showToast(message, type) {
  toast.textContent = message;
  toast.className = type || "";
  toast.removeAttribute("hidden");
  setTimeout(() => {
    toast.setAttribute("hidden", "");
  }, 2500);
}

// ── Modal ──
function openAddModal() {
  editingId = null;
  modalTitle.textContent = "Add Prompt";
  fieldTitle.value = "";
  fieldCategory.value = "";
  fieldBody.value = "";
  fieldTags.value = "";
  fieldFavorite.checked = false;
  modalError.setAttribute("hidden", "");
  populateCategoryDatalist();
  modal.removeAttribute("hidden");
  fieldTitle.focus();
}

function openEditModal(prompt) {
  editingId = prompt.id;
  modalTitle.textContent = "Edit Prompt";
  fieldTitle.value = prompt.title || "";
  fieldCategory.value = prompt.category || "";
  fieldBody.value = prompt.body || "";
  fieldTags.value = (prompt.tags || []).join(", ");
  fieldFavorite.checked = !!prompt.isFavorite;
  modalError.setAttribute("hidden", "");
  populateCategoryDatalist();
  modal.removeAttribute("hidden");
  fieldTitle.focus();
}

function closeModal() {
  modal.setAttribute("hidden", "");
  editingId = null;
}

function populateCategoryDatalist() {
  db.getAllCategories().then((categories) => {
    categoryList.textContent = "";
    categories.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      categoryList.appendChild(opt);
    });
  });
}

function handleModalSave() {
  const title = fieldTitle.value.trim();
  const body = fieldBody.value.trim();

  if (!title || !body) {
    modalError.removeAttribute("hidden");
    return;
  }
  modalError.setAttribute("hidden", "");

  const tags = fieldTags.value
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const fields = {
    title,
    body,
    category: fieldCategory.value.trim(),
    tags,
    isFavorite: fieldFavorite.checked,
  };

  const action = editingId
    ? db.updatePrompt(editingId, fields).then(() => editingId)
    : db.addPrompt(fields);

  action
    .then(() => {
      closeModal();
      refreshList();
    })
    .catch((err) => {
      showToast("Save failed: " + err.message, "error");
    });
}

// ── List rendering ──
function renderList(prompts) {
  promptList.innerHTML = "";

  if (prompts.length === 0) {
    emptyState.removeAttribute("hidden");
    return;
  }
  emptyState.setAttribute("hidden", "");

  prompts.forEach((p) => {
    const li = document.createElement("li");
    li.className = "prompt-card";

    // Header row: title + favorite star
    const header = document.createElement("div");
    header.className = "card-header";

    const title = document.createElement("span");
    title.className = "card-title";
    title.textContent = p.title;

    const fav = document.createElement("span");
    fav.className = "card-fav" + (p.isFavorite ? " favorited" : "");
    fav.textContent = "★";

    header.appendChild(title);
    header.appendChild(fav);
    li.appendChild(header);

    // Category badge
    if (p.category) {
      const badge = document.createElement("span");
      badge.className = "card-category";
      badge.textContent = p.category;
      li.appendChild(badge);
    }

    // Preview
    const preview = document.createElement("div");
    preview.className = "card-preview";
    const bodyPreview =
      p.body.length > 120 ? p.body.slice(0, 120) + "…" : p.body;
    preview.textContent = bodyPreview;
    li.appendChild(preview);

    // Actions
    const actions = document.createElement("div");
    actions.className = "card-actions";
    actions.dataset.promptId = p.id;

    const btnInject = document.createElement("button");
    btnInject.className = "btn-inject";
    btnInject.textContent = "Inject";
    btnInject.addEventListener("click", () => injectPrompt(p));

    const btnEdit = document.createElement("button");
    btnEdit.className = "btn-edit";
    btnEdit.textContent = "Edit";
    btnEdit.addEventListener("click", () => openEditModal(p));

    const btnDelete = document.createElement("button");
    btnDelete.className = "btn-delete";
    btnDelete.textContent = "Delete";
    btnDelete.addEventListener("click", () => confirmDelete(p.id, actions));

    actions.appendChild(btnInject);
    actions.appendChild(btnEdit);
    actions.appendChild(btnDelete);
    li.appendChild(actions);

    promptList.appendChild(li);
  });
}

// ── Delete confirmation ──
function confirmDelete(id, actionsEl) {
  const originalHTML = actionsEl.innerHTML;
  actionsEl.innerHTML = "";
  actionsEl.className = "card-actions confirm-delete";

  const label = document.createElement("span");
  label.textContent = "Delete?";

  const btnYes = document.createElement("button");
  btnYes.textContent = "Yes";
  btnYes.addEventListener("click", () => {
    db.deletePrompt(id)
      .then(() => {
        refreshList();
        showToast("Deleted", "success");
      })
      .catch((err) => showToast("Delete failed: " + err.message, "error"));
  });

  const btnNo = document.createElement("button");
  btnNo.textContent = "No";
  btnNo.addEventListener("click", () => {
    actionsEl.className = "card-actions";
    actionsEl.innerHTML = originalHTML;
  });

  actionsEl.appendChild(label);
  actionsEl.appendChild(btnYes);
  actionsEl.appendChild(btnNo);

  // Auto-restore after 3 seconds
  setTimeout(() => {
    if (actionsEl.classList.contains("confirm-delete")) {
      actionsEl.className = "card-actions";
      actionsEl.innerHTML = originalHTML;
    }
  }, 3000);
}

// ── Category filter population ──
function populateCategoryFilter() {
  db.getAllCategories().then((categories) => {
    const currentValue = filterCategory.value;
    // Keep only the first "All Categories" option
    while (filterCategory.options.length > 1) {
      filterCategory.remove(1);
    }
    categories.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c;
      opt.textContent = c;
      filterCategory.appendChild(opt);
    });
    filterCategory.value = currentValue;
  });
  populateCategoryDatalist();
}

// ── Refresh list ──
function refreshList() {
  const searchQ = searchInput.value.trim();
  const category = filterCategory.value;
  const favoritesOnly = btnFavorites.getAttribute("aria-pressed") === "true";
  const sort = sortOrder.value;

  let promise;
  if (category) {
    promise = db.getPromptsByCategory(category);
  } else {
    promise = db.getAllPrompts();
  }

  promise
    .then((prompts) => {
      // Search filter
      if (searchQ) {
        return db.searchPrompts(searchQ).then((searched) => {
          // If we had a category filter, intersect
          if (category) {
            const searchedIds = new Set(searched.map((p) => p.id));
            return prompts.filter((p) => searchedIds.has(p.id));
          }
          return searched;
        });
      }
      return prompts;
    })
    .then((prompts) => {
      // Favorites filter
      let filtered = prompts;
      if (favoritesOnly) {
        filtered = prompts.filter((p) => p.isFavorite);
      }

      // Sort
      const sorted = [...filtered].sort((a, b) => {
        switch (sort) {
          case "oldest":
            return a.createdAt - b.createdAt;
          case "most-used":
            return b.usageCount - a.usageCount;
          case "az":
            return a.title.localeCompare(b.title);
          case "newest":
          default:
            return b.createdAt - a.createdAt;
        }
      });

      // Show total count
      db.getAllPrompts().then((all) => {
        resultCount.textContent = `Showing ${sorted.length} of ${all.length}`;
      });

      renderList(sorted);
      populateCategoryFilter();
    })
    .catch((err) => {
      showToast("Error loading prompts: " + err.message, "error");
    });
}

// ── Inject prompt ──
function injectPrompt(prompt) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url) {
      showToast("Could not determine active tab", "error");
      return;
    }

    const hostname = new URL(tab.url).hostname;
    if (!SITE_CONFIG[hostname]) {
      showToast("Open a supported AI chat platform first", "error");
      return;
    }

    chrome.tabs.sendMessage(
      tab.id,
      { type: "INJECT_PROMPT", text: prompt.body },
      (response) => {
        if (chrome.runtime.lastError) {
          console.log(chrome.runtime.lastError);
          showToast("Could not reach the page. Reload and try again.", "error");
          return;
        }

        if (response && response.success) {
          db.incrementUsage(prompt.id).then(() => {
            refreshList();
          });
          showToast("Injected into " + response.platform, "success");
        } else {
          const reason = response ? response.reason : "Unknown error";
          showToast("Injection failed: " + reason, "error");
        }
      },
    );
  });
}

// ── Export ──
function exportPrompts() {
  db.getAllPrompts()
    .then((prompts) => {
      const json = JSON.stringify(prompts, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = "promptvault-" + date + ".json";
      a.click();
      URL.revokeObjectURL(url);
      showToast("Exported " + prompts.length + " prompts", "success");
    })
    .catch((err) => {
      showToast("Export failed: " + err.message, "error");
    });
}

// ── Import ──
function importPrompts(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    let records;
    try {
      records = JSON.parse(e.target.result);
    } catch (err) {
      showToast("Invalid JSON file", "error");
      return;
    }

    if (!Array.isArray(records)) {
      showToast("JSON must be an array of prompts", "error");
      return;
    }

    let importedCount = 0;
    let skippedCount = 0;

    db.getAllPrompts()
      .then((existing) => {
        const existingTitles = new Set(
          existing.map((p) => p.title.toLowerCase()),
        );

        const importPromises = [];
        records.forEach((record) => {
          if (
            !record.title ||
            !record.body ||
            typeof record.title !== "string" ||
            typeof record.body !== "string"
          ) {
            skippedCount++;
            return;
          }

          if (existingTitles.has(record.title.toLowerCase())) {
            skippedCount++;
            return;
          }

          // Normalize tags
          let tags = record.tags;
          if (typeof tags === "string") {
            tags = tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean);
          }
          if (!Array.isArray(tags)) {
            tags = [];
          }

          importPromises.push(
            db.addPrompt({
              title: record.title,
              body: record.body,
              category: record.category || "",
              tags,
              isFavorite: !!record.isFavorite,
              usageCount: record.usageCount || 0,
            }),
          );
          importedCount++;
        });

        return Promise.all(importPromises);
      })
      .then(() => {
        refreshList();
        showToast(
          "Imported " + importedCount + ", skipped " + skippedCount,
          "success",
        );
      })
      .catch((err) => {
        showToast("Import failed: " + err.message, "error");
      });
  };
  reader.readAsText(file);
}

// ── Event wiring ──
document.addEventListener("DOMContentLoaded", () => {
  // Search with debounce
  searchInput.addEventListener("input", () => {
    btnClearSearch.hidden = !searchInput.value;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      saveFilterState();
      refreshList();
    }, 200);
  });

  btnClearSearch.addEventListener("click", () => {
    searchInput.value = "";
    btnClearSearch.hidden = true;
    saveFilterState();
    refreshList();
  });

  filterCategory.addEventListener("change", () => {
    saveFilterState();
    refreshList();
  });

  sortOrder.addEventListener("change", () => {
    saveFilterState();
    refreshList();
  });

  btnFavorites.addEventListener("click", () => {
    const pressed = btnFavorites.getAttribute("aria-pressed") === "true";
    btnFavorites.setAttribute("aria-pressed", pressed ? "false" : "true");
    saveFilterState();
    refreshList();
  });

  btnAdd.addEventListener("click", openAddModal);
  btnEmptyAdd.addEventListener("click", openAddModal);

  // Modal
  btnModalCancel.addEventListener("click", closeModal);
  btnModalSave.addEventListener("click", handleModalSave);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  // Enter to save in modal
  modal.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.target.tagName !== "TEXTAREA") {
      e.preventDefault();
      handleModalSave();
    }
  });

  // Export
  btnExport.addEventListener("click", exportPrompts);

  // Import
  const settingsBtn = $("btn-settings");
  settingsBtn.addEventListener("click", () => {
    importInput.click();
  });
  importInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      importPrompts(e.target.files[0]);
      importInput.value = "";
    }
  });

  // Restore state and init
  restoreFilterState();
});
