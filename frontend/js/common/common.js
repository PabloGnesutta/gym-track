import { $ } from "../lib/dom.js";
import { _log } from "../lib/logger.js";


/**
 * @template T
 * @typedef {object} _ServiceReturnObj
 * @property {T} [data]
 * @property {string} [errorMsg]
 */


/**
 * @template T
 * @typedef {Promise<_ServiceReturnObj<T>>} ServiceReturn
 */


/**
 * @typedef {''|'Initial'} AppStatus
 * @typedef {object} AppState
 * @property {AppStatus} status
 * @property {boolean} creatingExercise
 */

/**
 * Main state of the application.
 * Will be initialized (and therefore overwritten) by the initAppState function
 * @type {AppState}
 */
const appState = {
  status: '',
  creatingExercise: false,
};

/**
 * @type {AppState[]}
 */
const stateHistory = [];

const $app = $('app');

/**
 * @param {keyof AppState} field 
 * @param {*} value 
 */
function setStateField(field, value, recordHistory = true) {
  // @ts-ignore
  appState[field] = value;
  $app.dataset[field] = value;
  _log(stateHistory);
  if (recordHistory) {
    stateHistory.push({ ...appState });
  }
}


function initAppState() {
  setStateField('status', 'Initial', false);
  setStateField('creatingExercise', false, false);
  // initial history point
  stateHistory.push({ ...appState });
  // _log(stateHistory);

  $('welcome').addEventListener('click', e => _log(stateHistory));
}

function revertHistory(steps = 1) {
  const len = stateHistory.length;
  if (!len || len <= steps) { return; }

  const prevStateIndex = len - steps - 1;
  const prevState = stateHistory[prevStateIndex];

  // _log('stateHistory', stateHistory);
  // _log('prevStateIndex', prevStateIndex);
  // _log('prevState', prevState);

  for (const key in appState) {
    setStateField(key, prevState[key], false);
  }

  stateHistory.splice(prevStateIndex + 1, len);
  _log(stateHistory);

}

export { appState, setStateField, initAppState, revertHistory };