import { setCurrentView } from "../common/state.js";
import { syncUrl } from "../common/router.js";
import { $queryOne, $new, $newInput, $button } from "../lib/dom.js";
import { _error } from "../lib/logger.js";
import { showConfirm } from "../lib/dialog.js";
import { pen_solid, svg_trash, svg_check, svg_close } from "../svg/svgFn.js";
import { fetchMuscles, renameMuscle, deleteMuscle } from "../local-db/muscle-db.js";
import { fetchAndRenderExercises } from "./exercise-ui.js";
import { pageTitle } from "./ui.js";


/** @typedef {import("../local-db/muscle-db.js").Muscle} Muscle */

const musclesList = $queryOne('#musclesView .list');

/**
 * Opens the Muscles management view - fetched fresh every time, no cache
 * (there's no dbStore.muscles), same "always fresh" call Analytics already
 * makes.
 */
async function openMuscles() {
  setCurrentView('Muscles');
  pageTitle.innerText = 'Músculos';
  syncUrl('/muscles');
  await renderMuscles();
}

async function renderMuscles() {
  musclesList.innerHTML = '';
  const muscles = await fetchMuscles();
  if (!muscles.length) {
    musclesList.append($new({ class: 'analytics-empty', text: 'Todavía no hay músculos etiquetados.' }));
    return;
  }
  muscles.forEach(appendMuscleRow);
}

/** @param {Muscle} muscle */
function appendMuscleRow(muscle) {
  const row = $new({ class: 'row muscle-row', dataset: [['muscleId', String(muscle.id)]] });
  renderMuscleRowDisplay(row, muscle);
  musclesList.append(row);
}

/**
 * @param {HTMLElement} row
 * @param {Muscle} muscle
 */
function renderMuscleRowDisplay(row, muscle) {
  row.innerHTML = '';
  const countLabel = `${muscle.exerciseCount} ejercicio${muscle.exerciseCount === 1 ? '' : 's'}`;

  const actions = $new({ class: 'muscle-row-actions' });
  actions.append($new({ class: 'muscle-row-count', text: countLabel }));
  row.append($new({ class: 'muscle-row-name', text: muscle.name }), actions);

  $button({
    appendTo: actions,
    svgFn: pen_solid,
    dataset: [['action', 'edit']],
    listener: { fn: () => renderMuscleRowEdit(row, muscle) },
  });
  $button({
    appendTo: actions,
    svgFn: svg_trash,
    dataset: [['action', 'delete']],
    listener: { fn: () => tryDeleteMuscle(row, muscle) },
  });
}

/**
 * @param {HTMLElement} row
 * @param {Muscle} muscle
 */
function renderMuscleRowEdit(row, muscle) {
  row.innerHTML = '';
  const input = $newInput({ class: 'muscle-row-input', value: muscle.name });
  const actions = $new({ class: 'muscle-row-actions' });
  row.append(input, actions);

  const commit = () => submitMuscleRename(row, muscle, input.value);

  $button({
    appendTo: actions,
    svgFn: svg_check,
    dataset: [['action', 'save']],
    listener: { fn: commit },
  });
  $button({
    appendTo: actions,
    svgFn: svg_close,
    dataset: [['action', 'cancel']],
    listener: { fn: () => renderMuscleRowDisplay(row, muscle) },
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { renderMuscleRowDisplay(row, muscle); }
  });
  input.focus();
  input.select();
}

/**
 * @param {HTMLElement} row
 * @param {Muscle} muscle
 * @param {string} newName
 */
async function submitMuscleRename(row, muscle, newName) {
  const trimmed = newName.trim();
  if (!trimmed || trimmed.toLocaleLowerCase() === muscle.name) {
    renderMuscleRowDisplay(row, muscle);
    return;
  }

  const result = await renameMuscle(muscle.id, trimmed);
  if (!result.data) {
    _error(result.errorMsg);
    renderMuscleRowDisplay(row, muscle);
    return;
  }

  // A rename to a name that already exists for this user merges into it
  // server-side (see muscleService.js) - the surviving row may be a
  // *different* muscle already rendered elsewhere in this list, and
  // exerciseCount may shift on either side. A full re-render is the
  // simplest correct way to reflect that at this data volume, rather than
  // patching two rows by hand.
  await renderMuscles();
  // dbStore.exercises is populated once at boot and never otherwise
  // invalidated (see fetchAndRenderExercises's own doc comment) - without
  // this, the exercise list's search-by-muscle and the single-exercise view
  // would keep showing this tag under its old name until the next login.
  await fetchAndRenderExercises();
}

/**
 * @param {HTMLElement} row
 * @param {Muscle} muscle
 */
async function tryDeleteMuscle(row, muscle) {
  const count = muscle.exerciseCount;
  const message = count > 0
    ? `"${muscle.name}" se usa en ${count} ejercicio${count === 1 ? '' : 's'}. Si lo borrás, se va a quitar de ${count === 1 ? 'ese ejercicio' : 'esos ejercicios'}. ¿Querés continuar?`
    : `¿Seguro que querés borrar "${muscle.name}"?`;

  const confirmed = await showConfirm({ title: 'Borrar músculo', message, confirmLabel: 'Borrar' });
  if (!confirmed) { return; }

  const result = await deleteMuscle(muscle.id);
  if (!result.data) { _error(result.errorMsg); return; }
  row.remove();
  if (count > 0) { await fetchAndRenderExercises(); } // same staleness fix as rename
}

export { openMuscles };
