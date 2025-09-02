import { dataState, dbStore, setStateField } from "../common/state.js";
import { timeAgo, toYYYYMMDD } from "../lib/date.js";
import { $, $form, $getInner, $new, $newInput, $queryOne } from "../lib/dom.js";
import { _error, _log } from "../lib/logger.js";
import { updateExercise } from "../local-db/exercise-db.js";
import { createSet, deleteSession, getSessionsForExercise } from "../local-db/set-db.js";
import { setExerciseLastWeightRecord } from "./exercise-ui.js";


/**
 * @typedef {import("../local-db/exercise-db.js").Exercise} Exercise 
 * @typedef {import("../local-db/set-db.js").Session} Session
 */

const singleExerciseView = $('singleExerciseView');
const currentDateLog = $getInner(singleExerciseView, '.current-date-log');
const previousDaysLog = $getInner(singleExerciseView, '.previous-days-log');
const setForm = $form('createSetForm');
const sessionForm = $form('sessionForm');


/**
 * Populates new set form and set history
 * @param {Exercise} exercise 
 */
async function populateSetData(exercise) {
  input: {
    setForm.dataset.exerciseKey = (exercise._key || '').toString();
    const lastSession = exercise.lastSession;
    if (lastSession) {
      const lastWeightRow = lastSession.sets[lastSession.sets.length - 1];
      setForm.elements['weight'].value = lastWeightRow.w;
      setForm.elements['reps'].value = lastWeightRow.r[lastWeightRow.r.length - 1];
      setForm.elements['reps'].focus();
      setForm.elements['reps'].select();
    } else {
      setForm.elements['weight'].focus();
      setForm.elements['weight'].select();
    }
  }

  history: {
    currentDateLog.innerHTML = '';
    previousDaysLog.innerHTML = '';

    const sessions = await getSessionsForExercise((exercise._key || ''));
    if (!sessions.length) {
      currentDateLog.innerHTML = 'No hay sets registrados para este ejercicio';
      break history;
    }


    for (const session of sessions) {
      const today = toYYYYMMDD(new Date());
      const date = toYYYYMMDD(session.date);
      if (date === today) {
        currentDateLog.innerHTML = '';
        appendSessionHistoryRow(currentDateLog, session);
      } else {
        appendSessionHistoryRow(previousDaysLog, session);
      }
    }
  }
}

/**
 * @param {HTMLElement} container
 * @param {Session} session
 */
function appendSessionHistoryRow(container, session) {
  const key = (session._key || '').toString();
  const _weightConainer = $new({ class: 'weight-container' });
  const _date = $new({ class: 'date', text: timeAgo(session.date) });
  const _row = $new({
    class: 'row',
    children: [_weightConainer, _date],
    dataset: [
      ['clickAction', 'openSessionForm'],
      ['sessionKey', key],
    ],
  });

  for (const { w, r } of session.sets) {
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

  const exerciseKey = setForm.dataset.exerciseKey || 0;
  const exercise = dbStore.exercises.find(e => e._key == exerciseKey);
  if (!exercise) {
    return _error('No hay ejercicio seleccionado');
  }

  const result = await createSet(exercise, +weight, +reps, new Date());
  if (result.data) {
    currentDateLog.innerHTML = '';
    appendSessionHistoryRow(currentDateLog, result.data);
    setExerciseLastWeightRecord(exercise);
  } else {
    _error(result.errorMsg);
  }
}

/**
 * 
 * @param {Event} e 
 */
async function submitSession(e) {
  e.preventDefault();
  const formData = new FormData(sessionForm);
  _log('submit session', sessionForm);
}

/**
 * Currently prompts to delete session.
 * Eventually it will display a form to edit the session.
 * @param {string} sessionKey 
 */
async function openSessionForm(sessionKey) {
  if (!dataState.currentExercise) { return; }
  const exKey = (dataState.currentExercise._key || '').toString();
  if (!exKey) { return; }
  const _key = +sessionKey;
  const sessions = dbStore.sessions[exKey];
  const session = sessions.find(s => s._key === _key);
  if (!session) { return; }

  const label = $getInner(sessionForm, '.session-label');
  label.innerText = dataState.currentExercise.name + ' - ' + toYYYYMMDD(session.date);

  // TODO: Append inputs to edit session
  const content = $getInner(sessionForm, '.form-content');
  // $newInput();

  dataState.currentSession = session;
  setStateField('showSessionForm', true);
}

/**
 * Deletes session from DB.
 * Deletes it from current Exercise's lastSession (DB and Store) if necessary
 * @param {Event} e 
*/
async function tryDeleteSession(e) {
  e.preventDefault();
  if (!confirm('Seguro que querés borrar esta sesión?')) { return; }

  const session = dataState.currentSession;
  if (!session) { return; }
  const strSessionKey = (session._key || '').toString();
  await deleteSession(session);
  const row = $queryOne(`[data-session-key="${strSessionKey}"]`);
  row.remove();

  const exercise = dataState.currentExercise;
  if (!exercise) { return; }
  // Update Exercise's lastSession if necessary
  const lastSession = exercise.lastSession;
  if (!lastSession) { return; }
  if (toYYYYMMDD(session.date) === toYYYYMMDD(lastSession.date)) {
    exercise.lastSession = null;
    await updateExercise(exercise, null, null, new Date());
  }
  setStateField('showSessionForm', false);
}


export { populateSetData, submitSet, openSessionForm, submitSession, tryDeleteSession };