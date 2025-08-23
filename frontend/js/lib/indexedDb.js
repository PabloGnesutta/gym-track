import { _error, _info, _warn } from './logger.js';


/**
 * @typedef {'exercises'} ObjectStores
 * @typedef {'nameIndex'} Indexes
 * @typedef {IDBValidKey | IDBKeyRange} StoreKey
 * @typedef {{ _key: StoreKey, [field: string]: * }}  DbRecord
 */

const dbName = 'TestDB';
const dbVersion = 99;


/** @type {Record<ObjectStores, ObjectStores>} */
const _stores = {
  exercises: 'exercises',
};

/** @type {IDBOpenDBRequest} */
var openDbRequest;

/** @type {IDBDatabase|null} */ // @ts-ignore
var db = null;


/** */
function initializeIndexedDb() {
  openDbRequest = indexedDB.open(dbName, dbVersion);
  openDbRequest.onupgradeneeded = onDbUpgradeNeeded;
  openDbRequest.onsuccess = onDbOpenSuccess;
  openDbRequest.onerror = onDbOpenError;
}


/**
 * Initialize Object Stores
 * Note: It will delete old ones on each new version
 */
function onDbUpgradeNeeded(e) {
  _info(' __ Updating IndexedDB');
  db = openDbRequest.result;
  if (!db.objectStoreNames.contains(_stores.exercises)) {
    const store = db.createObjectStore(
      _stores.exercises,
      { autoIncrement: true }
    );
    store.createIndex('nameIndex', 'name', { unique: true })
  }
}

/** Database opened successfully */
function onDbOpenSuccess(e) {
  db = openDbRequest.result;
  _info(' __ Base de datos abierta - Versión ' + db.version);
}


/** 
 * Used to clean up data by setting a lower DB version
 */
function onDbOpenError(e) {
  if (e.target.error.name === 'VersionError') {
    /**
     * This error triggers when the version in the CODE is LOWER than
     * the version installed on the browser.
     * This should never happen because versions should only go up.
     * We can leverage this feature to wipe all the data whil testing.
     * Just make dbVersion lower and it wil wipe all the data 
     */
    _info(' __ Deleting old IndexedDB');
    const deleteDbRequest = indexedDB.deleteDatabase(dbName);
    deleteDbRequest.onsuccess = () => {
      _info(' __ Base de datos borrada exitosamente, creando una nueva');
      openDbRequest = indexedDB.open(dbName, dbVersion);
      openDbRequest.onupgradeneeded = onDbUpgradeNeeded;
      openDbRequest.onsuccess = onDbOpenSuccess;
    };
    deleteDbRequest.onerror = e => {
      _error(' __ Error al borrar base de datos', e);
    };
  } else {
    _error(' __ Error al abrir base de datos', e);
  }
}


/**
 * Insert or update record.
 * For insertions, key is optional if the store is configured with autoincrement
 * @template T
 * @param {ObjectStores} storeName
 * @param {T} value
 * @param {IDBValidKey} [key]
 * @returns {Promise<IDBValidKey>} Key of the insterted/updated object
 */
async function putOne(storeName, value, key) {
  return new Promise((res, rej) => {
    if (!db) return rej('No database found');
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    const putRequest = store.put(value, key);
    putRequest.onsuccess = e => {
      // @ts-ignore
      return res(e.target.result)
    };
    putRequest.onerror = e => {
      _error(' __ Error putting record');
      return rej(e);
    };
  });
}

/**
 * Get one record from a store using the key
 * @param {ObjectStores} storeName
 * @param {StoreKey} key
 * @returns {Promise<DbRecord|null>}
 */
async function getOne(storeName, key) {
  return new Promise((res, rej) => {
    if (!db) return rej('No database found');
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const getRequest = store.get(key);
    getRequest.onsuccess = e => {
      /** @type {DbRecord} */ // @ts-ignore
      const record = e.target.result
      if (!record) {
        _warn(` __ Item with key: ${key} not found in store ${storeName}`)
        return res(null)
      }
      record.id = key
      return res(record);
    };
    getRequest.onerror = e => {
      _error(' __ Error getting record from IndexedDB');
      return rej(e);
    };
  });
}


/**
 * @param {ObjectStores} storeName 
 * @param {Indexes} indexName 
 * @param {StoreKey} indexValue 
 */
async function getOneWithIndex(storeName, indexName, indexValue) {
  return new Promise((res, rej) => {
    if (!db) return rej('No database found');
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);

    const getRequest = index.get(indexValue)
    getRequest.onsuccess = e => {
      // @ts-ignore
      const record = e.target.result
      if (!record) {
        _warn(` __ Item with index key: "${indexValue}" not found in store "${storeName}"`)
        return res(null)
      }
      return res(record);
    };

    getRequest.onerror = e => {
      _error(' __ Error geting record from IndexedDB using index');
      return rej(e);
    };
  });
}

/**
 * Gets all the records for a given store
 * @param {ObjectStores} storeName
 * @returns {Promise<DbRecord[]>}
 */
async function getAll(storeName) {
  return new Promise((res, rej) => {
    if (!db) { return rej('IndexedDB not initialized'); }
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const getAllCursor = store.openCursor();

    /** @type {Array<DbRecord>} */
    const records = [];
    getAllCursor.onsuccess = e => {
      const cursor = getAllCursor.result;
      if (cursor) {
        const record = cursor.value
        record.id = cursor.primaryKey
        records.push(record)
        cursor.continue();
      } else {
        _info(' __ IndexedDB entries read');
        return res(records);
      }
    };
    getAllCursor.onerror = e => {
      _error(' __ Error geting IndexedDB entries');
      return rej(e);
    };
  });
}


export { initializeIndexedDb, putOne, getOne, getAll, getOneWithIndex }