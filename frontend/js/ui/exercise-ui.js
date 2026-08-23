import { timeAgo } from "../lib/date.js";
import { _error, _log } from "../lib/logger.js";
import { matches, normalize } from "../lib/string.js";
import { clearArray, clearObj } from "../lib/utils.js";
import { $, $form, $getInner, $input, $new, $queryOne, $queryOneInput } from "../lib/dom.js";
import { appState, dataState, dbStore, setCurrentView, setStateField } from "../common/state.js";
import { createExercise, deleteExercise, fetchExercises, updateExercise } from "../local-db/exercise-db.js";
import { pageTitle } from "./ui.js";
import { populateSetData } from "./set-ui.js";


/**
 * @typedef {import("../local-db/exercise-db.js").Exercise} Exercise
 */


const exerciseList = $queryOne('#exerciseListView .list');

const singleExerciseView = $('singleExerciseView');
const exerciseName = $getInner(singleExerciseView, '.name');

const exerciseForm = $form('exerciseForm');
const exerciseNameInput = $queryOneInput('#exerciseForm input[name="exerciseName"]');
const submitExerciseBtn = $queryOne('#exerciseForm .submit');

/** Search */
const searchInput = $input('searchExercise');
searchInput.addEventListener('input',
  e => {
    if (!e.target) { return; }
    /** @type {string} */ // @ts-ignore
    const value = e.target.value;
    dbStore.exercises.forEach(e => {
      if (
        matches(e.normalizedName || '', value)
        || matches(e.normalizedMuscles || '', value)
      ) {
        $queryOne(`[data-exercise-key="${e._key}"]`).classList.remove('display-none');
      } else {
        $queryOne(`[data-exercise-key="${e._key}"]`).classList.add('display-none');
      }
    });
  });


/** 
 * Open create exercise modal and focus name input
 * @param {boolean} isEdit
 */
function openExerciseForm(isEdit) {
  const submitExerciseLabel = $getInner(submitExerciseBtn, ' .label');
  const formTitle = $getInner(exerciseForm, '.form-title');
  if (isEdit === true) {
    setStateField('editingExercise', true);
    if (!dataState.currentExercise) {
      return;
    }
    const musclesInput = $queryOneInput('#exerciseForm input[name="muscles"]');
    const exercise = dataState.currentExercise;
    exerciseNameInput.value = exercise.name;
    if (exercise.muscles) {
      musclesInput.value = exercise.muscles?.join(',');
    }
    submitExerciseLabel.innerText = 'Guardar Cambios';
    formTitle.innerText = 'Editar Ejercicio';
  } else {
    setStateField('creatingExercise', true);
    submitExerciseLabel.innerText = 'Crear Ejercicio';
    formTitle.innerText = 'Nuevo Ejercicio';
  }

  setStateField('showExerciseForm', true);
  exerciseNameInput.focus();
  exerciseNameInput.select();
}

/** Open exercise list view */
async function openExerciseList() {
  setCurrentView('ExerciseList');
  pageTitle.innerText = 'Ejercicios';
}

/**
 * Fetch all exercises from DB.
 * Render exercise list.
 * Store them in dbstore.
 *
 * Idempotent on purpose: clears both the rendered `.list` DOM and the
 * dbStore caches first, rather than assuming this only ever runs once per
 * page load. It didn't used to need to - before accounts existed there was
 * no way to trigger a second boot cycle without a full page reload (which
 * naturally resets both) - but appBoot.js's afterLogin() can now run again
 * after a logout/login within the same page, and without this the list
 * (and dbStore.exercises) would just accumulate duplicate rows across
 * accounts. dbStore.sessions is cleared too, for the same reason: exercise
 * ids restart from 1 per account, so a stale cache entry keyed by id could
 * otherwise leak one account's session data into another's view.
 */
async function fetchAndRenderExercises() {
  exerciseList.innerHTML = '';
  clearArray(dbStore.exercises);
  clearObj(dbStore.sessions);

  const exercises = await fetchExercises();
  exercises.forEach(exercise => {
    appendExerciseRow(exerciseList, exercise);
    if (!exercise.muscles) {
      exercise.muscles = [];
    }
    exercise.normalizedName = normalize(exercise.name);
    exercise.normalizedMuscles = normalize(exercise.muscles.join(','));
    dbStore.exercises.push(exercise);
  });
}

/**
 * Creates or updates Exercise in DB and UI
 * @param {Event} e 
 */
async function submitExercise(e) {
  e.preventDefault();
  const formData = new FormData(exerciseForm);
  const name = formData.get('exerciseName') || '';
  if (!(typeof name === 'string')) { return; }

  /** @type {string[]} */
  var muscles = [];
  const _m = formData.get('muscles') || '';
  if (typeof _m === 'string') { muscles = _m.split(',').map(v => v.trim()); }

  if (appState.editingExercise === true && dataState.currentExercise) {
    // Edit
    const result = await updateExercise(dataState.currentExercise, name, muscles, new Date());
    if (result.data) {
      updateExerciseRow(exerciseList, result.data);
      exerciseName.innerText = result.data.name;
    } else {
      _error(result.errorMsg);
    }
    setStateField('editingExercise', false);
  }
  else {
    // Create
    const result = await createExercise(name, muscles, new Date());
    if (result.data) {
      appendExerciseRow(exerciseList, result.data);
    } else {
      _error(result.errorMsg);
    }
    setStateField('creatingExercise', false);
  }

  exerciseForm.reset();
  setStateField('showExerciseForm', false);
}



/**
 * TODO: Esto está incorrecto.
 * Removes the current row, then creates another one and prepends it
 * @param {HTMLDivElement} container 
 * @param {import("../local-db/exercise-db.js").Exercise} exercise
 */
function updateExerciseRow(container, exercise) {
  const row = $getInner(container, '.row');
  row.remove();
  appendExerciseRow(container, exercise, true);
}

/**
 * Creates and appends Exercise row.
 * Adds listener to open Single Exercise View.
 * @param {HTMLDivElement} container 
 * @param {import("../local-db/exercise-db.js").Exercise} exercise
 * @param {boolean} prepend 
 */
function appendExerciseRow(container, exercise, prepend = false) {
  const key = (exercise._key || '').toString();
  const lastSetData = $new({ class: 'last-set-data' });
  const timestamp = $new({ class: 'timestamp' });
  const lastSetDataContainer = $new({ class: 'right-side', children: [timestamp, lastSetData] });
  const exerciseRow = $new({
    class: 'row',
    dataset: [
      ['clickAction', 'openSingleExercise'],
      ['exerciseKey', key],
    ],
    children: [
      $new({ class: 'exerciseName', text: exercise.name }),
      lastSetDataContainer,
    ],
  });

  if (prepend) {
    container.prepend(exerciseRow);
  } else {
    container.append(exerciseRow);
  }

  setExerciseRowLastSetData(exercise, exerciseRow);
}

/**
 * Set the row from the exercise list that belongs to the given exercise,
 * sets its last set data and when that happened (time ago).
 * @param {Exercise} exercise 
 * @param {HTMLDivElement} [exerciseRow]
 */
function setExerciseRowLastSetData(exercise, exerciseRow) {
  if (!exerciseRow) {
    exerciseRow = $queryOne(`.row[data-exercise-key="${exercise._key}"]`);
  }

  const timeagoString = timeAgo(exercise.lastSession?.date || exercise.updatedAt);

  exerciseRow.dataset.timestamp = timeagoString;

  const lastSetData = $getInner(exerciseRow, '.last-set-data');
  const timestamp = $getInner(exerciseRow, '.timestamp');

  timestamp.innerText = timeagoString;
  const lastSession = exercise.lastSession;
  if (lastSession) {
    const lastWeight = lastSession.sets[lastSession.sets.length - 1];
    lastSetData.innerText = `${lastWeight.w}kg x ${lastWeight.r[lastWeight.r.length - 1]}`;
  }
}

async function tryDeleteExercise() {
  const exercise = dataState.currentExercise;
  if (!exercise) {
    return;
  }
  const exerciseKey = exercise._key;
  if (!exerciseKey) {
    return;
  }
  if (!confirm(`¿Seguro que querés borrar el ejercicio ${exercise.name}?`)) {
    return;
  }

  // Server-side deleteExercise already cascades to the exercise's sessions
  // in one transaction (see backend/src/services/exerciseService.js).
  await deleteExercise(exerciseKey);

  closeSingleExercise();

  const exIndex = dbStore.exercises.findIndex(ex => ex._key === exerciseKey);
  if (exIndex !== -1) {
    dbStore.exercises.splice(exIndex, 1);
  }

  delete dbStore.sessions[exerciseKey.toString()];

  const node = document.querySelector(`#exerciseListView .list [data-exercise-key="${exerciseKey}"]`);
  if (node) {
    node.remove();
  }

  dataState.currentExercise = null;
}

/**
 * Opens single exercise view.
 * Populates Set fields with last set data. 
 * Fills out set history.
 * @param {string} exerciseKey 
 */
async function openSingleExercise(exerciseKey) {
  const key = +exerciseKey;
  let exercise = dataState.currentExercise || undefined;
  if (key !== exercise?._key) {
    exercise = dbStore.exercises.find(e => e._key === key);
  }

  if (!exercise) { return _error('Exercise not found'); }

  setCurrentView('SingleExercise');
  pageTitle.innerText = 'Ejercicio actual';

  dataState.currentExercise = exercise;
  exerciseName.innerText = exercise.name;
  await populateSetData(exercise);
}

function closeSingleExercise() {
  if (appState.currentView !== 'SingleExercise') {
    return;
  }
  setCurrentView('ExerciseList');
  openExerciseList();
}


export {
  fetchAndRenderExercises, openExerciseList, openSingleExercise, openExerciseForm, appendExerciseRow, submitExercise, setExerciseRowLastSetData,
  tryDeleteExercise, closeSingleExercise, submitExerciseBtn
};