/* db.js — IndexedDB wrapper. Everything in this app is local-only. */

const DB_NAME = 'advtasks';
const DB_VERSION = 1;
const STORES = ['boards', 'cards', 'settings', 'activity'];

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('boards')) {
        db.createObjectStore('boards', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cards')) {
        const cardStore = db.createObjectStore('cards', { keyPath: 'id' });
        cardStore.createIndex('board_id', 'board_id', { unique: false });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('activity')) {
        const actStore = db.createObjectStore('activity', { keyPath: 'id' });
        actStore.createIndex('card_id', 'card_id', { unique: false });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
  return dbPromise;
}

function tx(storeName, mode = 'readonly') {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

const DB = {
  async put(storeName, obj) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(obj);
      req.onsuccess = () => resolve(obj);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async get(storeName, key) {
    const store = await tx(storeName);
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async delete(storeName, key) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(key);
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async getAll(storeName) {
    const store = await tx(storeName);
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async getAllByIndex(storeName, indexName, value) {
    const store = await tx(storeName);
    return new Promise((resolve, reject) => {
      const idx = store.index(indexName);
      const req = idx.getAll(value);
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async clear(storeName) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve(true);
      req.onerror = (e) => reject(e.target.error);
    });
  },

  async exportAll() {
    const out = {};
    for (const name of STORES) {
      out[name] = await DB.getAll(name);
    }
    out._meta = { exported_at: new Date().toISOString(), version: DB_VERSION };
    return out;
  },

  async importAll(data, { wipe = false } = {}) {
    for (const name of STORES) {
      if (!data[name]) continue;
      if (wipe) await DB.clear(name);
      const store = await tx(name, 'readwrite');
      for (const obj of data[name]) {
        store.put(obj);
      }
    }
    return true;
  },
};

function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function nowISO() {
  return new Date().toISOString();
}
