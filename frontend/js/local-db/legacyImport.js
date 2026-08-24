import { getAll } from "../lib/indexedDb.js";
import { importBatch } from "./importBatch.js";
import { _error, _info } from "../lib/logger.js";


// A JSON-string status object, not a plain boolean - see maybeImportLegacyData.
// Named differently from the old (pre-idempotent-import) `legacyImportDone`
// boolean flag on purpose: any device already carrying that old flag (set
// `true` regardless of whether the import actually fully succeeded - see the
// bug this replaces) needs a fresh chance under the new logic, and reusing
// the same key would make that device's stale `true` block it forever.
const LEGACY_IMPORT_STATUS_KEY = 'legacyImportStatus';

/**
 * @typedef {{status: 'declined'} | {status: 'complete'} | {status: 'pending'}} ImportStatus
 */

/** @returns {ImportStatus | null} */
function readStatus() {
  const raw = localStorage.getItem(LEGACY_IMPORT_STATUS_KEY);
  if (!raw) { return null; }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** @param {ImportStatus} status */
function writeStatus(status) {
  localStorage.setItem(LEGACY_IMPORT_STATUS_KEY, JSON.stringify(status));
}

/**
 * One-time upgrade path for anyone with data from before accounts/remote
 * storage existed: offers to upload whatever is still sitting in IndexedDB
 * to the newly-created/logged-into account. Runs on every boot while
 * logged in (see `appBoot.js`'s `afterLogin()`) - needs a user_id to attach
 * the data to. IndexedDB is not written to by this at all, only read - the
 * source data survives regardless of how the upload goes.
 *
 * The confirm() prompt is shown at most once ('declined' or a first
 * successful-with-no-failures run permanently stops this from running
 * again). A run that reports any failure - realistic on a flaky mobile
 * connection uploading a long history, since `apiCall()` never throws, so a
 * dropped request just silently skips that one item and the loop moves on -
 * leaves the status as 'pending' instead, so the *next* login retries
 * automatically, with no re-prompt (the user already opted in once).
 * Retrying is safe: `importBatch()` is idempotent, reconciling against
 * what the account already has rather than blindly re-posting everything.
 */
async function maybeImportLegacyData() {
  const existingStatus = readStatus();
  if (existingStatus?.status === 'declined' || existingStatus?.status === 'complete') { return; }

  /** @type {any[]} */
  let exercises = [];
  try {
    exercises = await getAll('exercises');
  } catch (err) {
    // IndexedDB unavailable/blocked - nothing to import, don't ask again.
    _error(' - maybeImportLegacyData: could not read IndexedDB', err);
    writeStatus({ status: 'complete' });
    return;
  }

  if (!exercises.length) {
    writeStatus({ status: 'complete' });
    return;
  }

  if (!existingStatus) {
    const confirmed = confirm(
      'Encontramos ejercicios guardados en este dispositivo de una versión anterior. ¿Querés importarlos a tu cuenta?'
    );
    if (!confirmed) {
      writeStatus({ status: 'declined' });
      return;
    }
    // Recorded before the import runs, not after - so a retry (this status
    // being anything other than unset/'declined'/'complete' skips straight
    // to importing, no re-prompt) still happens even if the import itself
    // never gets the chance to finish this time.
    writeStatus({ status: 'pending' });
  }

  const sessions = await getAll('sessions');
  const counts = await importBatch({ exercises, sessions });
  _info(' - legacy data imported', counts);

  const failed = counts.exercisesFailed + counts.sessionsFailed;
  if (failed === 0) {
    writeStatus({ status: 'complete' });
    if (counts.exercisesCreated || counts.sessionsCreated) {
      alert(`Se importaron ${counts.exercisesCreated} ejercicios y ${counts.sessionsCreated} sesiones.`);
    }
  } else {
    // Left as 'pending' - retried automatically on the next login.
    alert(
      `Se importaron ${counts.exercisesCreated} ejercicios y ${counts.sessionsCreated} sesiones, `
      + `pero ${failed} no se pudieron subir (revisá tu conexión). Vamos a reintentar la próxima vez que abras la app.`
    );
  }
}


export { maybeImportLegacyData };
