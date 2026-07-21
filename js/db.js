/**
 * IndexedDB wrapper for storing uploaded books and bookmarks.
 * Everything is persisted locally in the browser, so a book's reading
 * position survives closing the tab, the browser, or the whole app.
 */
(function (global) {
  const DB_NAME = 'grasya-reading';
  const DB_VERSION = 1;
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('books')) {
          db.createObjectStore('books', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('bookmarks')) {
          const store = db.createObjectStore('bookmarks', { keyPath: 'id' });
          store.createIndex('bookId', 'bookId', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(storeName, mode) {
    return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
  }

  function reqToPromise(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  const Books = {
    async add(book) {
      const store = await tx('books', 'readwrite');
      await reqToPromise(store.put(book));
      return book;
    },
    async update(id, patch) {
      const store = await tx('books', 'readwrite');
      const existing = await reqToPromise(store.get(id));
      if (!existing) return null;
      const updated = Object.assign(existing, patch);
      await reqToPromise(store.put(updated));
      return updated;
    },
    async get(id) {
      const store = await tx('books', 'readonly');
      return reqToPromise(store.get(id));
    },
    async all() {
      const store = await tx('books', 'readonly');
      return reqToPromise(store.getAll());
    },
    async remove(id) {
      const store = await tx('books', 'readwrite');
      await reqToPromise(store.delete(id));
      const bmStore = await tx('bookmarks', 'readwrite');
      const idx = bmStore.index('bookId');
      const marks = await reqToPromise(idx.getAll(id));
      for (const m of marks) {
        await reqToPromise(bmStore.delete(m.id));
      }
    },
  };

  const Bookmarks = {
    async add(bookmark) {
      const store = await tx('bookmarks', 'readwrite');
      await reqToPromise(store.put(bookmark));
      return bookmark;
    },
    async forBook(bookId) {
      const store = await tx('bookmarks', 'readonly');
      const idx = store.index('bookId');
      const results = await reqToPromise(idx.getAll(bookId));
      return results.sort((a, b) => a.createdAt - b.createdAt);
    },
    async remove(id) {
      const store = await tx('bookmarks', 'readwrite');
      await reqToPromise(store.delete(id));
    },
  };

  global.GrasyaDB = { Books, Bookmarks };
})(window);
