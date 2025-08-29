import { appState, dbStore } from "../common/state.js";
import { timeAgo, toYYYYMMDD } from "../lib/date.js";
import { $, $form, $getInner, $new } from "../lib/dom.js";
import { _error, _log } from "../lib/logger.js";
import { convertSessionData, createSet, deleteSet, getSessionsForExercise } from "../local-db/set-db.js";


/**
 * @typedef {import("../local-db/exercise-db.js").Exercise} Exercise 
 */

const singleExerciseView = $('singleExerciseView');
const currentDateLog = $getInner(singleExerciseView, '.current-date-log');
const previousDaysLog = $getInner(singleExerciseView, '.previous-days-log');
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
    const sessions = await getSessionsForExercise((exercise._key || ''));
    if (!sessions.length) {
      currentDateLog.innerHTML = 'No hay sets registrados para este ejercicio';
      break setHistory;
    } else {
      currentDateLog.innerHTML = '';
    }

    // TODO: Transform data from DB into weight x reps cards
    for (const date in sessions) {
      const today = toYYYYMMDD(new Date())
      if (date === today) {
        appendSessionData(currentDateLog, sessions[date])
      } else {
        appendSessionData(previousDaysLog, sessions[date])
      }
    }
  }
}

/**
 * @param {HTMLElement} container
 * @param {import("../local-db/set-db.js").ExerciseSession} session
 */
function appendSessionData(container, session) {
  _log({ session })

  const _weightConainer = $new({ class: 'weight-container' })
  const _date = $new({ class: 'date', text: timeAgo(session.date) })
  const _row = $new({
    class: 'row',
    children: [_weightConainer, _date]
  });

  for (const { w, r } of session.sets) {
    // TODO: GROUP BY WEIGHT
    // const _weight = $new({ class: 'weight', text: `${w}kg X ` });
    // r.forEach(reps => {
    //   _weight.innerText += reps + ',';
    // });
    // _weight.innerText = _weight.innerText.substring(0, _weight.innerText.length - 1);
    // _weightConainer.append(_weight);
  }

  container.append(_row);
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
    // TODO: Update current session card
  } else {
    _error(result.errorMsg);
  }
}


/**
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
  currentDateLog.removeChild(setRow);
  if (currentDateLog.innerHTML === '') {
    currentDateLog.innerHTML = 'No hay sets registrados para este ejercicio';
  }
}


export { populateSetData, submitSet, tryDeleteSet };