import { setCurrentView } from "../common/state.js";
import { syncUrl } from "../common/router.js";
import { pageTitle } from "./ui.js";


/**
 * Placeholder page - no analytics exist yet, this just gives the bottom
 * tab bar and the client-side router a real second destination to point at.
 */
function openAnalytics() {
  setCurrentView('Analytics');
  pageTitle.innerText = 'Análisis';
  syncUrl('/analytics');
}


export { openAnalytics };
