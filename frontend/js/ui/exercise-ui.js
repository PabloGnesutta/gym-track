import { appState, dataState, dbStore, setCurrentView, setStateField } from "../common/state.js";
import { timeAgo } from "../lib/date.js";
import { $, $form, $getInner, $new, $queryOne } from "../lib/dom.js";
import { _error, _log, _warn } from "../lib/logger.js";
import { createExercise } from "../local-db/exercise-db.js";
import { populateSetData } from "./set-ui.js";
import { pageTitle } from "./ui.js";


/**
 * @typedef {import("../local-db/exercise-db.js").Exercise} Exercise
 */


const exercoseList = $queryOne('#exerciseListView .list');
const exerciseForm = $form('createExerciseForm');
const singleExerciseView = $('singleExerciseView');
const exerciseName = $getInner(singleExerciseView, '.name');


/** Open create exercise modal and focus name input */
function openExerciseCreate() {
    setStateField('creatingExercise', true);
    const nameInput = $queryOne('#createExerciseForm input[name="exerciseName"]');
    nameInput.focus();
    // @ts-ignore
    nameInput.select();
}

/**
 * Stores Exercise in DB and appends HTML row
 * @param {Event} e 
 */
async function submitExercise(e) {
    e.preventDefault();
    const formData = new FormData(exerciseForm);
    // @ts-ignore
    const result = await createExercise(formData.get('exerciseName') || '', formData.get('muscles') || '');
    if (result.data) {
        appendExerciseRow(exercoseList, result.data);
    } else {
        _error(result.errorMsg);
    }

    exerciseForm.reset();
    setStateField('creatingExercise', false);
}

/** Open exercise list view */
async function openExerciseList() {
    setCurrentView('ExerciseList');
    pageTitle.innerText = 'Ejercicios';
}

/** Fill Exercise list with rows */
function fillExerciseList() {
    dbStore.exercises.forEach(e => appendExerciseRow(exercoseList, e));
}

/**
 * Creates and appends Exercise row.
 * Adds listener to open Single Exercise View.
 * @param {HTMLDivElement} container 
 * @param {import("../local-db/exercise-db.js").Exercise} exercise
 */
function appendExerciseRow(container, exercise) {
    const key = (exercise._key || '').toString();
    const lastSetData = $new({ class: 'last-set-data' });
    const timestamp = $new({ class: 'timestamp', text: timeAgo(exercise.lastSession?.date || exercise.updatedAt) });
    const lastSetDataContainer = $new({ class: 'right-side', children: [lastSetData, timestamp] });
    const exerciseRow = $new({
        class: 'row',
        dataset: [
            ['clickAction', 'openSingleExercise'],
            ['exerciseKey', key],
        ],
        children: [
            $new({ class: 'exerciseName', text: exercise.name }),
            lastSetDataContainer,

        ],
    });

    setExerciseLastWeightRecord(exercise, lastSetData);
    container.append(exerciseRow);
}

/**
 * @param {Exercise} exercise 
 * @param {HTMLDivElement} [lastSetData]
 */
function setExerciseLastWeightRecord(exercise, lastSetData) {
    if (!lastSetData) {
        lastSetData = $queryOne(`.row[data-exercise-key="${exercise._key}"] .last-set-data`);
    }
    const lastSession = exercise.lastSession;
    if (lastSession) {
        const lastWeight = lastSession.sets[lastSession.sets.length - 1];
        lastSetData.innerText = `${lastWeight.w}kg X ${lastWeight.r[lastWeight.r.length - 1]}`;
    }
}

/**
 * Opens single exercise view.
 * Populates Set fields with last set data. 
 * Fills out set history.
 * @param {string} exerciseKey 
 */
async function openSingleExercise(exerciseKey) {
    const key = +exerciseKey;
    let exercise = dataState.currentExercise || undefined;
    if (key !== exercise?._key) {
        exercise = dbStore.exercises.find(e => e._key === key);
    }

    if (!exercise) { return _warn('Exercise not found'); }

    setCurrentView('SingleExercise');
    pageTitle.innerText = '';

    dataState.currentExercise = exercise;
    exerciseName.innerText = exercise.name;
    populateSetData(exercise);
}

function closeSingleExercise() {
    if (appState.currentView !== 'SingleExercise') { return; }
    setCurrentView('ExerciseList');
    openExerciseList()
}


export { fillExerciseList, openExerciseList, openSingleExercise, openExerciseCreate, appendExerciseRow, submitExercise, setExerciseLastWeightRecord, closeSingleExercise };