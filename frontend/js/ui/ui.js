import { dbStore, revertHistory, stateHistory } from "../common/state.js";
import { $, $button, $getInner, $getInnerInput, $queryOne } from "../lib/dom.js";
import { _log, _warn, openLogs } from "../lib/logger.js";
import { openExerciseCreate, openSingleExercise, submitExercise } from "./exercise-ui.js";
import { submitSet, tryDeleteSet } from "./set-ui.js";

/**
 * TODO (event delegation): Use some kind of map for events so it grabs the 
 * function using the clickAction dataset point as the function name.
 * This requires standardizing the input of the target functions:
 *   Something like always receiving a dataset, and having the function know what to do with it
 */
const ClickEventHandlers = {
  openSingleExercise,
  tryDeleteSet
};


function initUi() {
  const createSetForm = $('createSetForm')
  const weight = $getInnerInput(createSetForm, '[name="weight"]')
  weight.addEventListener('focus', () => weight.select())
  const reps = $getInnerInput(createSetForm, '[name="reps"]')
  reps.addEventListener('focus', () => reps.select())

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

  // Click Event Delegation
  $('app').addEventListener('click', e => {
    const target = e.target;
    if (!target) { return; }
    if (!(target instanceof HTMLElement)) { return; }
    const clickElement = target.closest('[data-click-action]');
    if (!clickElement) { return; }
    if (!('dataset' in clickElement)) { return; }

    // Elements that have click action should do something when clicked

    /** @type {DOMStringMap} */ //@ts-ignore
    const dataset = clickElement.dataset;
    switch (dataset.clickAction) {
      case 'openSingleExercise': openSingleExercise(dataset.exerciseKey || '');
        break;
      case 'tryDeleteSet': tryDeleteSet(e);
        break;
    }
  });
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
  // $button({
  //   label: 'DBStore',
  //   appendTo: mainFooter,
  //   listener: { fn: e => { _log(dbStore); openLogs(); } }
  // });
  $button({
    label: 'Logs',
    appendTo: mainFooter,
    listener: { fn: e => openLogs() }
  });
}


export { initUi, dbugBtns };