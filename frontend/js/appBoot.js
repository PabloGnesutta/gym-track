import { apiLogout, isLoggedIn } from "./api-caller/apiCaller.js";
import { dataState, setAuthStage } from "./common/state.js";
import { fetchAndRenderExercises, openExerciseList } from "./ui/exercise-ui.js";
import { maybeImportLegacyData } from "./local-db/legacyImport.js";


/**
 * Called on every app boot. Gates on whether a session token already exists
 * locally (no round trip - a stale/revoked token just fails the first real
 * API call and falls back to the login screen from there, since nothing
 * currently makes an authenticated call during boot - see afterLogin).
 */
async function bootApp() {
  if (!isLoggedIn()) {
    setAuthStage('login');
    return;
  }
  await afterLogin();
}

/**
 * Runs right after a successful login/signup, and on every subsequent boot
 * while already logged in. Exercise/session data now lives server-side
 * (local-db/exercise-db.js and set-db.js call the API, not IndexedDB);
 * maybeImportLegacyData() offers a one-time upload of whatever this device
 * still has sitting in IndexedDB from before accounts existed.
 */
async function afterLogin() {
  setAuthStage('ready');
  await maybeImportLegacyData();
  await fetchAndRenderExercises();
  openExerciseList();
}

async function logout() {
  await apiLogout();

  // dbStore.exercises/sessions are cleared by fetchAndRenderExercises()
  // itself on the next afterLogin() (see its own doc comment) - dataState
  // still needs clearing here so a stale reference to the previous
  // account's exercise/session doesn't linger in the meantime.
  dataState.currentExercise = null;
  dataState.currentSession = null;

  setAuthStage('login');
}


export { bootApp, afterLogin, logout };
