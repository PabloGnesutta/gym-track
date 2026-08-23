import { apiLogout, isLoggedIn } from "./api-caller/apiCaller.js";
import { setAuthStage } from "./common/state.js";
import { fetchAndRenderExercises, openExerciseList } from "./ui/exercise-ui.js";


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
 * while already logged in. Exercise/session data still lives entirely in
 * IndexedDB (unchanged) - the account only gates entry to the app for now.
 * Wiring this data to the server-side API (backend/src/http/apiRouter.js's
 * exercises/sessions routes, already built and tested) is the natural next
 * step, not done here.
 */
async function afterLogin() {
  setAuthStage('ready');
  await fetchAndRenderExercises();
  openExerciseList();
}

async function logout() {
  await apiLogout();
  setAuthStage('login');
}


export { bootApp, afterLogin, logout };
