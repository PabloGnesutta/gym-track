import { dbStore, revertHistory, setStateField, stateHistory } from "../common/state.js";
import { $, $button, $form, $queryOne } from "../lib/dom.js";
import { _log, openLogs } from "../lib/logger.js";
import { randomInt } from "../lib/math.js";
import { createExercise, fetchExercises } from "../local-db/exercise.js";


function initUi() {
  createHeaderBtns()
  createMainBtns();
  craeteFormButtons();
  configureModalBackdrop()
}

function configureModalBackdrop() {
  $queryOne('#main-modal .backdrop').addEventListener('pointerup', e => {
    /** @type {boolean} */ // @ts-ignore
    const clickedBackdrop = e.target.classList.contains('backdrop') || e.currentTarget.classList.contains('backdrop')
    if (clickedBackdrop) {
      console.log('clicked backdrop')
      revertHistory()
    }
  });
}

function openExerciseCreate() {
  setStateField('creatingExercise', true)
}

/**
 */
function openSetCreate() {
  // simulate selecting an exercise
  const exercise = dbStore.exercises[randomInt(0, dbStore.exercises.length - 1)]
  if (!exercise) {
    return alert('Ningún ejercicio seleccionado')
  }
  _log('exercise', exercise)
  $('exerciseName').innerText = exercise.name + '  | _key:' + exercise._key
  $('exerciseId').dataset.exerciseId = exercise._key

  setStateField('creatingSet', true)
}

function createHeaderBtns() {
  const mainHeader = $('main-header')
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
}

function openExerciseList() {
  fetchExercises()
}


function createMainBtns() {
  $button({
    label: 'Nuevo ejercicio',
    class: 'main-btn',
    appendTo: $('main-screen'),
    listener: { fn: openExerciseCreate }
  });


  $button({
    label: 'Ver ejercicios',
    class: 'main-btn',
    appendTo: $('main-screen'),
    listener: { fn: openExerciseList }
  });
  $button({
    label: 'Nuevo set',
    class: 'main-btn',
    appendTo: $('main-screen'),
    listener: { fn: openSetCreate }
  });
}

/**
 * Creates the buttons that will interact with the forms (submit, etc)
 */
function craeteFormButtons() {
  $button({
    label: 'Crear Ejercicio',
    class: 'submit-btn',
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

/**
 * @param {Event} e 
 */
async function submitExercise(e) {
  e.preventDefault();
  const form = $form('createExerciseForm');
  const formData = new FormData(form);

  // @ts-ignore
  const result = await createExercise(formData.get('exerciseName') || '', formData.get('muscles') || '');
  _log(result);
  if (result.errorMsg) {
    alert(result.errorMsg);
    setStateField('creatingExercise', false);
  } else {
    alert('Ejercicio creado exitosamente');
    form.reset();
    setStateField('creatingExercise', false);
  }
}

/**
 * @param {Event} e 
 */
async function submitSet(e) {
  console.log('submit set')
  e.preventDefault();
  const form = $form('createSetForm');
  const formData = new FormData(form);
  _log(formData.get('weight'))
  _log(formData.get('reps'))
  // @ts-ignore
  // const result = await createSet(formData.get('SetName') || '', formData.get('muscles') || '');
  // _log(result);
  // if (result.errorMsg) {
  //   alert(result.errorMsg);
  //   setStateField('creatingSet', false);
  // } else {
  //   alert('Ejercicio creado exitosamente');
  //   form.reset();
  //   setStateField('creatingSet', false);
  // }
}


export { initUi, openSetCreate };