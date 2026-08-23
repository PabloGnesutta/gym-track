import { getAll } from "../lib/indexedDb.js";
import { importBatch } from "./importBatch.js";
import { _error, _info } from "../lib/logger.js";


const LEGACY_IMPORT_DONE_KEY = 'legacyImportDone';

/**
 * One-time upgrade path for anyone with data from before accounts/remote
 * storage existed: offers to upload whatever is still sitting in IndexedDB
 * to the newly-created/logged-into account. Runs once (per browser) right
 * after a successful login - needs a user_id to attach the data to. Asked
 * once, either way (accepted or declined), never nagged again; IndexedDB is
 * not written to after this, only read here for the one-time upload.
 */
async function maybeImportLegacyData() {
  if (localStorage.getItem(LEGACY_IMPORT_DONE_KEY) === 'true') { return; }

  /** @type {any[]} */
  let exercises = [];
  try {
    exercises = await getAll('exercises');
  } catch (err) {
    // IndexedDB unavailable/blocked - nothing to import, don't ask again.
    _error(' - maybeImportLegacyData: could not read IndexedDB', err);
    localStorage.setItem(LEGACY_IMPORT_DONE_KEY, 'true');
    return;
  }

  if (!exercises.length) {
    localStorage.setItem(LEGACY_IMPORT_DONE_KEY, 'true');
    return;
  }

  const confirmed = confirm(
    'Encontramos ejercicios guardados en este dispositivo de una versión anterior. ¿Querés importarlos a tu cuenta?'
  );

  if (confirmed) {
    const sessions = await getAll('sessions');
    const counts = await importBatch({ exercises, sessions });
    _info(' - legacy data imported', counts);
  }

  localStorage.setItem(LEGACY_IMPORT_DONE_KEY, 'true');
}


export { maybeImportLegacyData };
