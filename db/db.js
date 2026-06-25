const DB_NAME = 'PromptVaultDB';
const DB_VERSION = 1;
const STORE_NAME = 'prompts';

let _db = null;

function openDB() {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });

      store.createIndex('by_category', 'category', { unique: false });
      store.createIndex('by_favorite', 'isFavorite', { unique: false });
      store.createIndex('by_usage', 'usageCount', { unique: false });
      store.createIndex('by_created', 'createdAt', { unique: false });
    };

    request.onsuccess = (event) => {
      _db = event.target.result;
      resolve(_db);
    };

    request.onerror = (event) => {
      reject(event.target.error);
    };
  });
}

const db = {
  openDB,

  getAllPrompts() {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  },

  getPromptsByCategory(category) {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const index = tx.objectStore(STORE_NAME).index('by_category');
        const request = index.getAll(IDBKeyRange.only(category));

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  },

  addPrompt(fields) {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const now = Date.now();
        const record = {
          title: fields.title,
          body: fields.body,
          category: fields.category || '',
          tags: fields.tags || [],
          isFavorite: fields.isFavorite || false,
          usageCount: fields.usageCount || 0,
          createdAt: now,
          updatedAt: now
        };
        const request = store.add(record);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    });
  },

  updatePrompt(id, fields) {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
          const record = getRequest.result;
          if (!record) {
            reject(new Error(`Prompt with id ${id} not found`));
            return;
          }
          Object.assign(record, fields);
          record.updatedAt = Date.now();
          const putRequest = store.put(record);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        };
        getRequest.onerror = () => reject(getRequest.error);
      });
    });
  },

  deletePrompt(id) {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });
  },

  incrementUsage(id) {
    return openDB().then((db) => {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
          const record = getRequest.result;
          if (!record) {
            reject(new Error(`Prompt with id ${id} not found`));
            return;
          }
          record.usageCount = (record.usageCount || 0) + 1;
          record.updatedAt = Date.now();
          const putRequest = store.put(record);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = () => reject(putRequest.error);
        };
        getRequest.onerror = () => reject(getRequest.error);
      });
    });
  },

  searchPrompts(query) {
    const lowerQuery = query.toLowerCase();
    return this.getAllPrompts().then((prompts) => {
      return prompts.filter((p) => {
        if (p.title && p.title.toLowerCase().includes(lowerQuery)) return true;
        if (p.body && p.body.toLowerCase().includes(lowerQuery)) return true;
        if (p.tags && Array.isArray(p.tags)) {
          return p.tags.some((tag) => tag && tag.toLowerCase().includes(lowerQuery));
        }
        return false;
      });
    });
  },

  getAllCategories() {
    return this.getAllPrompts().then((prompts) => {
      const categories = new Set();
      prompts.forEach((p) => {
        if (p.category) categories.add(p.category);
      });
      return Array.from(categories).sort((a, b) => a.localeCompare(b));
    });
  }
};
