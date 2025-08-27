import { dbStore, revertHistory, stateHistory } from "../common/state.js";
import { $, $button, $queryOne } from "../lib/dom.js";
import { _log, openLogs } from "../lib/logger.js";
import { openExerciseCreate, submitExercise, submitSet } from "./exercise-ui.js";


function initUi() {
  $button({
    listener: { fn: submitExercise },
    label: 'Crear Ejercicio',
    appendTo: $queryOne('#createExerciseForm .btns'),
  });

  $button({
    listener: { fn: submitSet },
    label: 'Agregar Set',
    appendTo: $queryOne('#createSetForm .btns'),
  });

  $('newExerciseBtn').addEventListener('click', openExerciseCreate);
  modalBackdropHandler();
}

/** Reverts history 1 step */
function modalBackdropHandler() {
  $queryOne('#main-modal .backdrop').addEventListener('click', e => {
    /** @type {boolean} */ // @ts-ignore
    const clickedBackdrop = e.target.classList.contains('backdrop') || e.currentTarget.classList.contains('backdrop');
    if (clickedBackdrop) {
      revertHistory();
    }
  });
}


function dbugBtns() {
  const mainFooter = $('mainFooter');
  $button({
    label: 'Logs',
    appendTo: mainFooter,
    listener: { fn: e => openLogs() }
  });
  $button({
    label: 'History',
    appendTo: mainFooter,
    listener: { fn: e => { _log(stateHistory); openLogs(); } }
  });
  $button({
    label: 'DBStore',
    appendTo: mainFooter,
    listener: { fn: e => { _log(dbStore); openLogs(); } }
  });
}


export { initUi, dbugBtns };