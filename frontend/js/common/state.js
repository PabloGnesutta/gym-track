import { $ } from "../lib/dom.js";
import { _log } from "../lib/logger.js";


/**
 * @typedef {import("../local-db/exercise-db.js").Exercise} Exercise
 * @typedef {import("../local-db/set-db.js").Session} Session
 */

/**
 * Main state of the application
 * @typedef {object} AppState
 * @property {boolean} creatingExercise
 * @property {boolean} editingExercise
 * @property {boolean} showExerciseForm
 * @property {boolean} showSessionForm
 * @property {Views} currentView
 * 
 * @typedef {'ExerciseList'|'SingleExercise'} Views
 * 
 * @typedef {object} DataState
 * @property {Exercise|null} currentExercise
 * @property {Session|null} currentSession
 */

/**
 * 
 * @typedef {object} DBStore
 * @property {Exercise[]} exercises
 * @property {Record<string, Session[]>} sessions
 */


/** @type {DBStore} - Cached records from the db */
const dbStore = {
    exercises: [],
    sessions: {},
};


/** @type {AppState} State of which features are active */
// will be overwritten by initAppState 
const appState = {
    creatingExercise: false,
    editingExercise: false,
    showExerciseForm: false,
    showSessionForm: false,
    currentView: 'ExerciseList',
};

/** @type {DataState} State of data stored in memory */
const dataState = {
    currentExercise: null,
    currentSession: null,
};
/** 
 * State history. Enables certain "undo" operations
 * @type {Array<AppState & {historyId:number}>} 
 */
const stateHistory = [];
const $app = $('app');
var historyId = 0;


/**
 * @param {keyof AppState} field 
 * @param {*} value
 * @param {boolean} doRecordHistory
 */
function setStateField(field, value, doRecordHistory = true) {
    // @ts-ignore // todo: check this
    appState[field] = value;
    $app.dataset[field] = value;
    if (doRecordHistory) {
        recordHistory();
    }
}

/**
 * @param {Views} view 
 */
function setCurrentView(view) {
    appState.currentView = view;
    $app.dataset.currentView = view;
}

function recordHistory() {
    stateHistory.push({ ...appState, historyId: ++historyId });
}

/** 
 * Goes to a state in the past by the given amount of steps
 * By default, it will go to the immediate previous step.
 */
function revertHistory(steps = 1) {
    const len = stateHistory.length;
    if (!len || len <= steps) { return; }
    _log('reverting history by ', steps);

    const prevStateIndex = len - steps - 1;
    const prevState = stateHistory[prevStateIndex];

    for (const key in appState) {
        // @ts-ignore
        setStateField(key, prevState[key], false);
    }
    stateHistory.splice(prevStateIndex + 1, len);
}


function initAppState() {
    setStateField('creatingExercise', false, false);
    setStateField('editingExercise', false, false);
    setStateField('showExerciseForm', false, false);
    setStateField('showSessionForm', false, false);
    setCurrentView('ExerciseList');
    recordHistory();
}

export { appState, dataState, stateHistory, setStateField, initAppState, revertHistory, setCurrentView, dbStore };