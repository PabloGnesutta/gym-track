import { dataState, dbStore, setStateField } from "../common/state.js";
import { $, $form, $getInner, $new, $queryOne } from "../lib/dom.js";
import { _error, _log, _warn } from "../lib/logger.js";
import { createExercise } from "../local-db/exercise-db.js";
import { populateSetData } from "./set-ui.js";


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
    setStateField('viewingExercises', true);
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
    const exerciseRow = $new({
        class: 'row',
        dataset: [
            ['clickAction', 'openSingleExercise'],
            ['exerciseKey', key],
        ],
        children: [
            $new({ class: 'exerciseName', text: exercise.name })
        ],
    });

    const lastSet = exercise.lastSet;
    if (lastSet) {
        const lastSetData = $new({ class: 'last-set-data', text: `${lastSet.weight} kg X ${lastSet.reps} reps` });
        exerciseRow.appendChild(lastSetData);
    }

    container.append(exerciseRow);
}


/**
 * Opens single exercise view.
 * Populates Set fields with last set data. 
 * Fills out set history.
 * @param {string} exerciseKey 
 */
async function openSingleExercise(exerciseKey) {
    setStateField('viewingSingleExercise', true);
    const key = +exerciseKey;
    if (key === dataState.currentExercise?._key) {
        return _log('current exercise already cached');
    }

    const exercise = dbStore.exercises.find(e => e._key === +exerciseKey);
    if (!exercise) { return _warn('Exercise not found'); }
    dataState.currentExercise = exercise;
    exerciseName.innerText = exercise.name;
    populateSetData(exercise);
}



export { fillExerciseList, openExerciseList, openSingleExercise, openExerciseCreate, appendExerciseRow, submitExercise };