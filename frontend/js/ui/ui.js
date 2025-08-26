import { dbStore, revertHistory, setStateField, stateHistory } from "../common/state.js";
import { $, $button, $queryOne } from "../lib/dom.js";
import { _log, openLogs } from "../lib/logger.js";
import { randomInt } from "../lib/utils.js";
import { setsForExercise } from "../local-db/set-db.js";
import { submitExercise, submitSet } from "./exercise-ui.js";


function initUi() {
  createHeaderBtns();
  $button({
    label: 'Nuevo ejercicio',
    appendTo: $('newExerciseBtnContainer'),
    listener: { fn: openExerciseCreate }
  });
  craeteFormButtons();
  addModalBackdropHandler();
}

/** Reverts history 1 step */
function addModalBackdropHandler() {
  $queryOne('#main-modal .backdrop').addEventListener('click', e => {
    /** @type {boolean} */ // @ts-ignore
    const clickedBackdrop = e.target.classList.contains('backdrop') || e.currentTarget.classList.contains('backdrop');
    if (clickedBackdrop) {
      revertHistory();
    }
  });
}

function openExerciseCreate() {
  setStateField('creatingExercise', true);
  const nameInput = $queryOne('#createExerciseForm input[name="exerciseName"]');
  nameInput.focus();
  // @ts-ignore
  nameInput.select();
}

/**
 */
async function openSetCreate() {
  // simulate selecting an exercise
  const exercise = dbStore.exercises[randomInt(0, dbStore.exercises.length - 1)];
  if (!exercise) {
    return alert('Ningún ejercicio seleccionado');
  }



  const exerciseSets = await setsForExercise(exercise._key || 0);
  _log('exerciseSets', exerciseSets);

  $('exerciseName').innerText = exercise.name + '  | _key:' + exercise._key;
  $('exerciseId').dataset.exerciseId = exercise._key?.toString();

  // TODO: Set input values as the last stored.
  // Also, focus input on open
  // Also, do the above in the exercise form

  setStateField('creatingSet', true);
  const weightInput = $queryOne('#createSetForm input[name="weight"]');
  weightInput.focus();
  // @ts-ignore
  weightInput.select();
}

function createHeaderBtns() {
  const mainHeader = $('main-header');
  $button({
    label: 'Logs',
    appendTo: mainHeader,
    listener: { fn: e => openLogs() }
  });
  $button({
    label: 'History',
    prependTo: mainHeader,
    listener: { fn: e => _log(stateHistory) }
  });
  $button({
    label: 'DBStore',
    appendTo: mainHeader,
    listener: { fn: e => _log(dbStore) }
  });
}

function createMainBtns() {

}

/**
 * Creates the buttons that will interact with the forms (submit, etc)
 */
function craeteFormButtons() {
  $button({
    label: 'Crear Ejercicio',
    appendTo: $queryOne('#createExerciseForm .form-content'),
    listener: { fn: submitExercise }
  });
  $button({
    label: 'Crear Set',
    class: 'cancel-btn',
    appendTo: $queryOne('#createSetForm .form-content'),
    listener: { fn: submitSet }
  });
}




export { initUi, openSetCreate };