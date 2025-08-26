import { dbStore, revertHistory, setStateField, stateHistory } from "../common/state.js";
import { $, $button, $form, $queryOne } from "../lib/dom.js";
import { _log, openLogs } from "../lib/logger.js";
import { randomInt } from "../lib/utils.js";
import { createExercise, fetchExercises } from "../local-db/exercise.js";
import { createSet, fetchSets, setsForExercise } from "../local-db/set.js";


function initUi() {
  createHeaderBtns();
  createMainBtns();
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
}

async function openExerciseList() {
  await fetchExercises();
  await fetchSets();
  console.log(dbStore);
}


function createMainBtns() {
  $button({
    label: 'Nuevo ejercicio',
    class: 'main-btn',
    appendTo: $('main-screen'),
    listener: { fn: openExerciseCreate, event: 'click' }
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
    listener: { fn: openSetCreate, event: 'click' }
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
  e.preventDefault();
  const form = $form('createSetForm');
  const formData = new FormData(form);
  const weight = formData.get('weight');
  const reps = formData.get('reps');
  if (!weight || typeof weight !== 'string' || !reps || typeof reps !== 'string') {
    return;
  }

  const exerciseId = $('exerciseId').dataset.exerciseId || 0;

  const result = await createSet(+exerciseId, +weight, +reps);
  if (result.errorMsg) {
    alert(result.errorMsg);
    setStateField('creatingSet', false);
  } else {
    alert('Set creado exitosamente:');
    _log(result);
    form.reset();
    setStateField('creatingSet', false);
  }
}


export { initUi, openSetCreate };