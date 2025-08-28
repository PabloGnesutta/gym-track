import { appState, dbStore } from "../common/state.js";
import { $, $form, $getInner, $new } from "../lib/dom.js";
import { _error, _log } from "../lib/logger.js";
import { createSet, deleteSet, getSetsForExercise } from "../local-db/set-db.js";


/**
 * @typedef {import("../local-db/exercise-db.js").Exercise} Exercise 
 */

const singleExerciseView = $('singleExerciseView');
const setHistory = $getInner(singleExerciseView, '.set-history');
const setForm = $form('createSetForm');


/**
 * Populates new set form and set history
 * @param {Exercise} exercise 
 */
async function populateSetData(exercise) {
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
      break setHistory;
    } else {
      setHistory.innerHTML = '';
    }

    groupByDate: {
      const grouped = dbStore.setsForExerciseByDate[(exercise._key || '').toString()];
      for (const date in grouped) {
        const _row = $new({
          class: 'row',
          children: [
            $new({ class: 'date', text: date })
          ]
        });
        for (const weight in grouped[date]) {
          const _weight = $new({ class: 'weight', text: `${weight} kg >>> ` });
          grouped[date][weight].forEach(reps => {
            _weight.innerText += reps + ', ';
          });
          _weight.innerText = _weight.innerText.substring(0, _weight.innerText.length - 2) + '.';
          _row.append(_weight);
        }
        setHistory.append(_row);
      }
    }
    // sets.forEach(set => appendSetHistoryRow(setHistory, set));
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
  const text = `${set.weight} kg X ${set.reps} reps    ${set.date?.toLocaleDateString()}`;
  const row = $new({
    class: 'row',
    text,
    dataset: [
      ['clickAction', 'tryDeleteSet'],
      ['setKey', (set._key || '').toString()],
    ],
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

/**
 * 
 * @param {Event} e 
 * @returns {Promise<void>}
 */
async function tryDeleteSet(e) {
  /** @type {HTMLDivElement} */ // @ts-ignore
  const setRow = e.target.closest('.row');
  if (!setRow) { return; }
  const setKey = +(setRow.dataset.setKey || 0);
  const doit = confirm('Querés borrar este set?');
  if (!doit) { return; }
  await deleteSet(setKey);
  setHistory.removeChild(setRow);
  _log({ html: setHistory.innerHTML });
  if (setHistory.innerHTML === '') {
    setHistory.innerHTML = 'No hay sets registrados para este ejercicio';
  }
}


export { populateSetData, submitSet, tryDeleteSet };