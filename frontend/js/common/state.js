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
 * Cached records from the d
 * @typedef {object} DBStore
 * @property {Exercise[]} exercises
 * @property {Record<string, Session[]>} sessions
 */

/** 
 * Note: appState will be overwritten by initAppState
 * @type {AppState} State of which features are active
 */
const appState = {
    creatingExercise: false,
    editingExercise: false,
    showExerciseForm: false,
    showSessionForm: false,
    currentView: 'ExerciseList',
};

/**
 * State of data stored in memory
 * @type {DataState}  
 */
const dataState = {
    currentExercise: null,
    currentSession: null,
};

/**
 * Cached records from the db 
 * @type {DBStore}
 */
const dbStore = {
    exercises: [],
    sessions: {},
};

const $app = $('app');

/**
 * @param {keyof AppState} field 
 * @param {*} value
 */
function setStateField(field, value) {
    // @ts-ignore // todo: check this
    appState[field] = value;
    $app.dataset[field] = value;
}

/**
 * @param {Views} view 
 */
function setCurrentView(view) {
    appState.currentView = view;
    $app.dataset.currentView = view;
}

function initAppState() {
    setStateField('creatingExercise', false);
    setStateField('editingExercise', false);
    setStateField('showExerciseForm', false);
    setStateField('showSessionForm', false);
    setCurrentView('ExerciseList');
}

export { appState, dataState, dbStore, initAppState, setStateField, setCurrentView };