import { appState, dataState, dbStore, setStateField } from "../common/state.js";
import { $, $button, $getInner, $getInnerInput, $queryOne } from "../lib/dom.js";
import { _info, _log, _warn, openLogs } from "../lib/logger.js";
import { arrow_left, pen_solid, svg_trash } from "../svg/svgFn.js";
import { closeSingleExercise, openExerciseForm, openSingleExercise, submitExercise, submitExerciseBtn } from "./exercise-ui.js";
import { openSessionForm, submitSession, submitSet, tryDeleteSession } from "./set-ui.js";


/**
 * TODO (event delegation): Use some kind of map for events so it grabs the 
 * function using the clickAction dataset point as the function name.
 * This requires standardizing the input of the target functions:
 *   Something like always receiving a dataset, and having the function know what to do with it
 */
// const ClickEventHandlers = {
//   openSingleExercise,
//   tryDeleteSet
// };

const mainHeader = $('mainHeader');
const pageTitle = $getInner(mainHeader, '.page-title');

function initUi() {
  const createSetForm = $('createSetForm');
  const weight = $getInnerInput(createSetForm, '[name="weight"]');
  weight.addEventListener('focus', () => weight.select());
  const reps = $getInnerInput(createSetForm, '[name="reps"]');
  reps.addEventListener('focus', () => reps.select());

  // Go Back Button
  $button({
    appendTo: $('goBack2'),
    svgFn: arrow_left,
    listener: {
      fn: e => {
        switch (appState.currentView) {
          case 'ExerciseList':
            break;
          case 'SingleExercise':
            closeSingleExercise();
            break;
          default: break;
        }
      }
    }
  });

  $('newExerciseBtn').addEventListener('click', () => { openExerciseForm(false); });

  $button({
    label: 'Crear Ejercicio',
    listener: { fn: submitExercise },
    appendTo: submitExerciseBtn,
  });

  $button({
    // Editar Ejercicio
    listener: { fn: () => openExerciseForm(true) },
    svgFn: pen_solid,
    appendTo: $queryOne('#singleExerciseView .edit-btn'),
  });

  $button({
    label: 'Agregar Set',
    listener: { fn: submitSet },
    appendTo: $queryOne('#createSetForm .submit')
  });

  $button({
    label: 'Guardar Cambios',
    listener: { fn: submitSession },
    appendTo: $queryOne('#sessionForm .submit')
  });

  $button({
    // Borrar Sesión
    listener: { fn: tryDeleteSession },
    svgFn: svg_trash,
    appendTo: $queryOne('#sessionForm .delete')
  });

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
      case 'openSingleExercise':
        openSingleExercise(dataset.exerciseKey || '');
        break;
      case 'openSessionForm':
        openSessionForm(dataset.sessionKey || '');
        break;
      default:
        return _warn(' :: clickAction not defined: ' + dataset.clickAction);
    }
  });
}

/** Reverts history 1 step */
function modalBackdropHandler() {
  $queryOne('#main-modal .backdrop').addEventListener('click', e => {
    /** @type {boolean} */ // @ts-ignore
    const clickedBackdrop = e.target.classList.contains('backdrop') || e.currentTarget.classList.contains('backdrop');
    if (clickedBackdrop) {
      setStateField('creatingExercise', false);
      setStateField('editingExercise', false);
      setStateField('showExerciseForm', false);
      setStateField('showSessionForm', false);
    }
  });
}


function dbugBtns() {
  const mainFooter = $('mainFooter');
  $button({
    label: 'State',
    appendTo: mainFooter,
    listener: {
      fn: e => {
        _log('dbStore', dbStore);
        _log('dataState', dataState);
      }
    }
  });
  $button({
    label: 'Logs',
    appendTo: mainFooter,
    listener: { fn: e => openLogs() }
  });
}


export { initUi, dbugBtns, pageTitle };