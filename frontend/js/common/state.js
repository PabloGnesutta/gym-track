import { $ } from "../lib/dom.js";
import { _log } from "../lib/logger.js";


/**
 * @typedef {import("../local-db/exercise-db.js").Exercise} Exercise
 * @typedef {import("../local-db/set-db.js").Set} Set
 */

/**
 * Main state of the application
 * @typedef {object} AppState
 * @property {boolean} creatingExercise
 * @property {boolean} creatingSet
 * @property {boolean} viewingExercises
 * @property {boolean} viewingSingleExercise
 * 
 * @typedef {object} DataState
 * @property {Exercise|null} currentExercise
 */

/**
 * 
 * @typedef {object} DBStore
 * @property {Exercise[]} exercises
 * @property {Record<string, Set[]>} setsForExercise
 * @property {Record<string, *>} setsForExerciseByDate
 */


/** @type {DBStore} - Cached records from the db */
const dbStore = {
    exercises: [],
    setsForExercise: {},
    setsForExerciseByDate: {},
};


/** @type {AppState} State of which features are active */
// will be overwritten by initAppState 
const appState = {
    creatingExercise: false,
    creatingSet: false,
    viewingExercises: false,
    viewingSingleExercise: false,
};

/** @type {DataState} State of data stored in memory */
const dataState = {
    currentExercise: null,
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
 */
function setStateField(field, value, doRecordHistory = true) {
    appState[field] = value;
    $app.dataset[field] = value;
    if (doRecordHistory) {
        recordHistory();
    }
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
    setStateField('viewingExercises', false, false);
    setStateField('viewingSingleExercise', false, false);
    setStateField('creatingSet', false, false);
    recordHistory();
}

export { appState, dataState, stateHistory, setStateField, initAppState, revertHistory, dbStore };