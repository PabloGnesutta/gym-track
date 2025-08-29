import { appState, dbStore } from "../common/state.js";
import { timeAgo } from "../lib/date.js";
import { $, $form, $getInner, $new } from "../lib/dom.js";
import { _error, _log } from "../lib/logger.js";
import { createSet, deleteSet, getSetsForExercise } from "../local-db/set-db.js";


/**
 * @typedef {import("../local-db/exercise-db.js").Exercise} Exercise 
 */

const singleExerciseView = $('singleExerciseView');
const historyOg = $getInner(singleExerciseView, '.history-og');
const historyDataStrucure1 = $getInner(singleExerciseView, '.history-data-structure-1');
const historyDataStrucure2 = $getInner(singleExerciseView, '.history-data-structure-2');
const historyDataStrucure3 = $getInner(singleExerciseView, '.history-data-structure-3');
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
      setForm.elements['reps'].focus();
      setForm.elements['reps'].select();
    } else {
      setForm.elements['weight'].focus();
      setForm.elements['weight'].select();
    }
  }

  setHistory: {
    const sets = await getSetsForExercise((exercise._key || ''));
    if (!sets.length) {
      historyOg.innerHTML = 'No hay sets registrados para este ejercicio';
      break setHistory;
    } else {
      historyOg.innerHTML = '';
    }

    const strExerciseKey = (exercise._key || '').toString()

    /** plain sets */
    sets.forEach(set => appendSetHistoryRow(historyOg, set));

    /** data structure 2 */
    const ds2 = dbStore.dataStructure2[strExerciseKey];
    for (const date in ds2) {
      appendSetHistoryDataStructure2(historyDataStrucure2, date, ds2[date])
    }

    /** data structure 3 */
    const ds3 = dbStore.dataStructure3[strExerciseKey];
    for (const date in ds3) {
      appendSetHistoryDataStructure3(historyDataStrucure3, date, ds3[date])
    }

    /** data structure 1 */
    // const ds1 = dbStore.dataStructure1[strExerciseKey];
    // for (const date in ds1) {
    //   appendSetHistoryDataStructure1(historyDataStrucure1, date, ds1)
    // }
  }
}

/**
 * @param {HTMLElement} container
 * @param {string} date
 * @param {import("../local-db/set-db.js").DS3Unit[]} _data
 */
function appendSetHistoryDataStructure3(container, date, _data) {
  const _weightConainer = $new({ class: 'weight-container' })
  const _date = $new({ class: 'date', text: timeAgo(date) })
  const _row = $new({
    class: 'row',
    children: [_weightConainer, _date]
  });

  for (const { w, r } of _data) {
    const _weight = $new({ class: 'weight', text: `${w}kg X ` });
    r.forEach(reps => {
      _weight.innerText += reps + ',';
    });
    _weight.innerText = _weight.innerText.substring(0, _weight.innerText.length - 1);
    _weightConainer.append(_weight);
  }

  container.append(_row);
}

/**
 * @param {HTMLElement} container
 * @param {string} date
 * @param {import("../local-db/set-db.js").DS2Unit[]} _data
 */
function appendSetHistoryDataStructure2(container, date, _data) {
  const _weightConainer = $new({ class: 'weight-container' })
  const _date = $new({ class: 'date', text: timeAgo(date) })
  const _row = $new({
    class: 'row',
    children: [_weightConainer, _date]
  });

  for (const [weight, repsArray] of _data) {
    const _weight = $new({ class: 'weight', text: `${weight}kg X ` });
    repsArray.forEach(reps => {
      _weight.innerText += reps + ',';
    });
    _weight.innerText = _weight.innerText.substring(0, _weight.innerText.length - 1);
    _weightConainer.append(_weight);
  }

  container.append(_row);
}

/**
 * @param {HTMLElement} container
 * @param {string} date
 * @param {*} _data
 */
function appendSetHistoryDataStructure1(container, date, _data) {
  const _weightConainer = $new({ class: 'weight-container' })
  const _date = $new({ class: 'date', text: timeAgo(date) })
  const _row = $new({
    class: 'row',
    children: [_weightConainer, _date]
  });

  for (const weight in _data[date]) {
    const _weight = $new({ class: 'weight', text: `${weight}kg X ` });
    _data[date][weight].forEach(reps => {
      _weight.innerText += reps + ',';
    });
    _weight.innerText = _weight.innerText.substring(0, _weight.innerText.length - 1);
    _weightConainer.prepend(_weight);
  }
  container.append(_row);
}

/**
 * Creates and appends Set row. 
 * @param {HTMLElement} container 
 * @param {import("../local-db/set-db.js").Set} set 
 */
function appendSetHistoryRow(container, set, prepend = false) {
  const text = `${set.weight} kg X ${set.reps} - ${timeAgo(set.date?.toString())}`;
  const row = $new({
    class: 'row',
    text,
    dataset: [
      ['clickAction', 'tryDeleteSet'],
      ['setKey', (set._key || '').toString()],
    ],
  });
  if (container.innerHTML === 'No hay sets registrados para este ejercicio') {
    container.innerHTML = '';
  }
  if (prepend) {
    container.prepend(row);
  } else {
    container.append(row);
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
    appendSetHistoryRow(historyOg, result.data, true);
    // TODO: Update exercise row, update history row
  } else {
    _error(result.errorMsg);
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
  historyOg.removeChild(setRow);
  _log({ html: historyOg.innerHTML });
  if (historyOg.innerHTML === '') {
    historyOg.innerHTML = 'No hay sets registrados para este ejercicio';
  }
}


export { populateSetData, submitSet, tryDeleteSet };