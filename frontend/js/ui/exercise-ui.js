import { dbStore, setStateField } from "../common/state.js"
import { $, $form, $getInner, $new, $queryOne } from "../lib/dom.js"
import { _error, _log } from "../lib/logger.js"
import { createExercise } from "../local-db/exercise-db.js"
import { createSet, setsForExercise } from "../local-db/set-db.js"


const list = $queryOne('#exerciseListView .list')
const exerciseForm = $form('createExerciseForm');

const singleExerciseView = $('singleExerciseView')
const exerciseName = $getInner(singleExerciseView, '.name')
const setHistory = $getInner(singleExerciseView, '.set-history')
const setForm = $form('createSetForm')


function fillExerciseList() {
    dbStore.exercises.forEach(e => {
        appendExerciseRow(list, e)
    })
}

async function openExerciseList() {
    setStateField('viewingExercises', true);
}



/**
 * Creates the exercise row and appends it to the container 
 * @param {HTMLDivElement} container 
 * @param {import("../local-db/exercise-db.js").Exercise} exercise
 */
function appendExerciseRow(container, exercise) {
    const key = (exercise._key || '').toString()
    const item = $new({
        class: 'row',
        dataset: [['exerciseKey', key]],
        listener: { fn: () => openSingleExercise(exercise) }, // TODO: Use event delegation
        children: [
            $new({ class: 'exerciseName', text: exercise.name })
        ],
    })

    const lastSet = exercise.lastSet
    if (lastSet) {
        const lastSetData = $new({ class: 'last-set-data', text: `${lastSet.weight} kg X ${lastSet.reps} reps` })
        item.appendChild(lastSetData)
    }

    container.append(item)
}

/**
 * @param {Event} e 
 */
async function submitExercise(e) {
    e.preventDefault();
    const formData = new FormData(exerciseForm);
    // @ts-ignore
    const result = await createExercise(formData.get('exerciseName') || '', formData.get('muscles') || '');
    if (result.data) {
        appendExerciseRow(list, result.data)
    } else {
        _error(result.errorMsg);
    }
    exerciseForm.reset();
    setStateField('creatingExercise', false);
}



/**
 * @param {import("../local-db/exercise-db.js").Exercise} exercise 
 */
async function openSingleExercise(exercise) {
    setStateField('viewingSingleExercise', true);
    exerciseName.innerText = exercise.name

    setInput: {
        setForm.dataset.exerciseId = (exercise._key || '').toString()
        if (exercise.lastSet) {
            setForm.elements['weight'].value = exercise.lastSet.weight
            setForm.elements['reps'].value = exercise.lastSet.reps
        }
        setForm.elements['reps'].focus()
        setForm.elements['reps'].select()
    }

    setHistory: {
        const sets = await setsForExercise((exercise._key || ''))
        if (!sets.length) {
            setHistory.innerHTML = 'No hay sets registrados para este ejercicio'
        } else {
            setHistory.innerHTML = ''
        }
        sets.forEach(set => {
            appendSetHistoryRow(setHistory, set)
        })
    }
}

/**
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

    const exerciseId = setForm.dataset.exerciseId || 0
    const exercise = dbStore.exercises.find(e => e._key == exerciseId)
    if (!exercise) {
        return _error('No hay ejercicio seleccionado')
    }

    const result = await createSet(exercise, +weight, +reps);
    if (result.data) {
        appendSetHistoryRow(setHistory, result.data, true)
    } else {
        _error(result.errorMsg);
    }
}

/**
 * @param {HTMLElement} container 
 * @param {import("../local-db/set-db.js").Set} set 
 */
function appendSetHistoryRow(container, set, prepend = false) {
    const row = $new({
        class: 'row',
        text: `${set.weight} kg X ${set.reps} reps = ${set.volume}`,
    })
    if (prepend) {
        container.prepend(row)
    } else {
        container.append(row)
    }
}


export { fillExerciseList, openExerciseList, appendExerciseRow, submitExercise, submitSet }