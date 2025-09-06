import { appState, dataState, dbStore, setCurrentView, setStateField } from "../common/state.js";
import { timeAgo } from "../lib/date.js";
import { $, $form, $getInner, $new, $queryOne, $queryOneInput } from "../lib/dom.js";
import { _error, _log } from "../lib/logger.js";
import { createExercise, updateExercise } from "../local-db/exercise-db.js";
import { populateSetData } from "./set-ui.js";
import { pageTitle } from "./ui.js";


/**
 * @typedef {import("../local-db/exercise-db.js").Exercise} Exercise
 */


const exerciseList = $queryOne('#exerciseListView .list');

const singleExerciseView = $('singleExerciseView');
const exerciseName = $getInner(singleExerciseView, '.name');

const exerciseForm = $form('exerciseForm');
const exerciseNameInput = $queryOneInput('#exerciseForm input[name="exerciseName"]');
const submitExerciseBtn = $queryOne('#exerciseForm .submit');


/** 
 * Open create exercise modal and focus name input
 * @param {boolean} isEdit
 */
function openExerciseForm(isEdit) {
    const submitExerciseLabel = $getInner(submitExerciseBtn, ' .label');
    const formTitle = $getInner(exerciseForm, '.form-title');
    if (isEdit === true) {
        setStateField('editingExercise', true);
        if (!dataState.currentExercise) { return; }
        const musclesInput = $queryOneInput('#exerciseForm input[name="muscles"]');
        const exercise = dataState.currentExercise;
        exerciseNameInput.value = exercise.name;
        if (exercise.muscles) {
            musclesInput.value = exercise.muscles?.join(',');
        }
        submitExerciseLabel.innerText = 'Guardar Cambios';
        formTitle.innerText = 'Editar Ejercicio';
    } else {
        setStateField('creatingExercise', true);
        submitExerciseLabel.innerText = 'Crear Ejercicio';
        formTitle.innerText = 'Nuevo Ejercicio';
    }

    setStateField('showExerciseForm', true);
    exerciseNameInput.focus();
    exerciseNameInput.select();
}

/** Open exercise list view */
async function openExerciseList() {
    setCurrentView('ExerciseList');
    pageTitle.innerText = 'Ejercicios';
}

/** Fill Exercise list with rows */
function fillExerciseList() {
    dbStore.exercises.forEach(e => appendExerciseRow(exerciseList, e));
}

/**
 * Creates or updates Exercise in DB and UI
 * @param {Event} e 
 */
async function submitExercise(e) {
    e.preventDefault();
    const formData = new FormData(exerciseForm);
    const name = formData.get('exerciseName') || '';
    if (!(typeof name === 'string')) { return; }

    var muscles = [];
    const _m = formData.get('muscles') || '';
    if (typeof _m === 'string') { muscles = _m.split(','); }

    if (appState.editingExercise === true && dataState.currentExercise) {
        // Edit
        const result = await updateExercise(dataState.currentExercise, name, muscles, new Date());
        if (result.data) {
            updateExerciseRow(exerciseList, result.data);
            exerciseName.innerText = result.data.name;
        } else { _error(result.errorMsg); }
        setStateField('editingExercise', false);
    }
    else {
        // Create
        const result = await createExercise(name, muscles, new Date());
        if (result.data) {
            appendExerciseRow(exerciseList, result.data);
        } else { _error(result.errorMsg); }
        setStateField('creatingExercise', false);
    }

    exerciseForm.reset();
    setStateField('showExerciseForm', false);
}



/**
 * Removes the current row, then creates another one and prepends it
 * @param {HTMLDivElement} container 
 * @param {import("../local-db/exercise-db.js").Exercise} exercise
 */
function updateExerciseRow(container, exercise) {
    const row = $getInner(container, '.row');
    row.remove();
    appendExerciseRow(container, exercise, true);
}

/**
 * Creates and appends Exercise row.
 * Adds listener to open Single Exercise View.
 * @param {HTMLDivElement} container 
 * @param {import("../local-db/exercise-db.js").Exercise} exercise
 * @param {boolean} prepend 
 */
function appendExerciseRow(container, exercise, prepend = false) {
    const key = (exercise._key || '').toString();
    const lastSetData = $new({ class: 'last-set-data' });
    const timestamp = $new({ class: 'timestamp' });
    const lastSetDataContainer = $new({ class: 'right-side', children: [timestamp, lastSetData] });
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

    if (prepend) {
        container.prepend(exerciseRow);
    } else {
        container.append(exerciseRow);
    }

    setExerciseRowLastSetData(exercise, exerciseRow);
}

/**
 * Set the row from the exercise list that belongs to the given exercise,
 * sets its last set data and when that happened (time ago).
 * @param {Exercise} exercise 
 * @param {HTMLDivElement} [exerciseRow]
 */
function setExerciseRowLastSetData(exercise, exerciseRow) {
    if (!exerciseRow) {
        exerciseRow = $queryOne(`.row[data-exercise-key="${exercise._key}"]`);
    }

    const timeagoString = timeAgo(exercise.lastSession?.date || exercise.updatedAt);

    exerciseRow.dataset.timestamp = timeagoString;

    const lastSetData = $getInner(exerciseRow, '.last-set-data');
    const timestamp = $getInner(exerciseRow, '.timestamp');

    timestamp.innerText = timeagoString;
    const lastSession = exercise.lastSession;
    if (lastSession) {
        const lastWeight = lastSession.sets[lastSession.sets.length - 1];
        lastSetData.innerText = `${lastWeight.w}kg x ${lastWeight.r[lastWeight.r.length - 1]}`;
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

    if (!exercise) { return _error('Exercise not found'); }

    setCurrentView('SingleExercise');
    pageTitle.innerText = 'Ejercicio actual';

    dataState.currentExercise = exercise;
    exerciseName.innerText = exercise.name;
    await populateSetData(exercise);
}

function closeSingleExercise() {
    if (appState.currentView !== 'SingleExercise') { return; }
    setCurrentView('ExerciseList');
    openExerciseList();
}


export { fillExerciseList, openExerciseList, openSingleExercise, openExerciseForm, appendExerciseRow, submitExercise, setExerciseRowLastSetData, closeSingleExercise, submitExerciseBtn };