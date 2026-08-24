import { apiLogout, isLoggedIn } from "./api-caller/apiCaller.js";
import { dataState, setAuthStage } from "./common/state.js";
import { fetchAndRenderExercises, openExerciseList } from "./ui/exercise-ui.js";
import { maybeImportLegacyData } from "./local-db/legacyImport.js";
import { renderSpecificRoute } from "./common/router.js";


/**
 * @typedef {import("./common/routeMatch.js").Route} Route
 */

/**
 * Captured once at the top of app.js (before anything touches history) and
 * re-applied once, the first time afterLogin() resolves - not on every
 * afterLogin() call, since a later logout/login within the same page load
 * must not replay a stale deep link from a previous session.
 * @type {Route|null}
 */
let pendingInitialRoute = null;

/**
 * Called on every app boot. Gates on whether a session token already exists
 * locally (no round trip - a stale/revoked token just fails the first real
 * API call and falls back to the login screen from there, since nothing
 * currently makes an authenticated call during boot - see afterLogin).
 * @param {Route} initialRoute
 */
async function bootApp(initialRoute) {
  pendingInitialRoute = initialRoute;

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

  if (pendingInitialRoute) {
    // Re-applies the URL the page actually loaded with (e.g. a deep link or
    // a refresh on /exercise/42), now that exercises are loaded and can be
    // found. Only relevant for the very first boot - a later logout/login
    // must fall through to the plain openExerciseList() below instead.
    renderSpecificRoute(pendingInitialRoute);
    pendingInitialRoute = null;
  } else {
    openExerciseList();
  }
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
