import { dbStore, setStateField } from "../common/state.js";
import { $, $form, $getInner, $new, $queryOne } from "../lib/dom.js";
import { _error, _log } from "../lib/logger.js";
import { createExercise } from "../local-db/exercise-db.js";
import { createSet, deleteSet, getSetsForExercise } from "../local-db/set-db.js";


const exercoseList = $queryOne('#exerciseListView .list');
const exerciseForm = $form('createExerciseForm');

const singleExerciseView = $('singleExerciseView');
const exerciseName = $getInner(singleExerciseView, '.name');
const setHistory = $getInner(singleExerciseView, '.set-history');
const setForm = $form('createSetForm');


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
    const item = $new({
        class: 'row',
        dataset: [['exerciseKey', key]],
        // TODO: Use event delegation
        listener: { fn: () => openSingleExercise(exercise) },
        children: [
            $new({ class: 'exerciseName', text: exercise.name })
        ],
    });

    const lastSet = exercise.lastSet;
    if (lastSet) {
        const lastSetData = $new({ class: 'last-set-data', text: `${lastSet.weight} kg X ${lastSet.reps} reps` });
        item.appendChild(lastSetData);
    }

    container.append(item);
}


/**
 * Opens single exercise view.
 * Populates Set fields with last set data. 
 * Fills out set history.
 * @param {import("../local-db/exercise-db.js").Exercise} exercise 
 */
async function openSingleExercise(exercise) {
    setStateField('viewingSingleExercise', true);
    exerciseName.innerText = exercise.name;

    setInput: {
        setForm.dataset.exerciseId = (exercise._key || '').toString();
        if (exercise.lastSet) {
            setForm.elements['weight'].value = exercise.lastSet.weight;
            setForm.elements['reps'].value = exercise.lastSet.reps;
        }
        setForm.elements['reps'].focus();
        setForm.elements['reps'].select();
    }

    setHistory: {
        const sets = await getSetsForExercise((exercise._key || ''));
        if (!sets.length) {
            setHistory.innerHTML = 'No hay sets registrados para este ejercicio';
        } else {
            setHistory.innerHTML = '';
        }
        sets.forEach(set => {
            appendSetHistoryRow(setHistory, set);
        });
    }
}

/**
 * Stores Set in DB and appends HTML row
 * @param {Event} e 
 */
async function submitSet(e) {
    e.preventDefault();
    const formData = new FormData(setForm);
    const weight = formData.get('weight');
    const reps = formData.get('reps');
    if (!weight || typeof weight !== 'string' || !reps || typeof reps !== 'string') {
        return;
    }

    const exerciseId = setForm.dataset.exerciseId || 0;
    const exercise = dbStore.exercises.find(e => e._key == exerciseId);
    if (!exercise) {
        return _error('No hay ejercicio seleccionado');
    }

    const result = await createSet(exercise, +weight, +reps);
    if (result.data) {
        appendSetHistoryRow(setHistory, result.data, true);
        // TODO: Update exercise row
        _log({ exercise });
    } else {
        _error(result.errorMsg);
    }
}

/**
 * Creates and appends Set row. 
 * @param {HTMLElement} container 
 * @param {import("../local-db/set-db.js").Set} set 
 */
function appendSetHistoryRow(container, set, prepend = false) {
    const text = `${set.weight} kg X ${set.reps} reps`;
    const row = $new({
        class: 'row',
        text,
        dataset: [['setKey', (set._key || '').toString()]],
        // TODO: Use event delegation
        listener: {
            /** Delete Set listener */
            fn: async e => {
                /** @type {HTMLDivElement} */ // @ts-ignore
                const setRow = e.target.closest('.row');
                if (!setRow) { return; }
                const setKey = +(setRow.dataset.setKey || 0);
                const doit = confirm('Querés borrar este set? ' + text);
                if (!doit) { return; }
                await deleteSet(setKey);
                setHistory.removeChild(setRow);
                _log({ html: setHistory.innerHTML });
                if (setHistory.innerHTML === '') {
                    setHistory.innerHTML = 'No hay sets registrados para este ejercicio';
                }
            }
        }
    });
    if (setHistory.innerHTML === 'No hay sets registrados para este ejercicio') {
        setHistory.innerHTML = '';
    }
    if (prepend) {
        container.prepend(row);
    } else {
        container.append(row);
    }
}


export { fillExerciseList, openExerciseList, openExerciseCreate, appendExerciseRow, submitExercise, submitSet };