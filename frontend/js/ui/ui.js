import { appState, setStateField } from "../common/state.js";
import { $, $button, $getInner, $new, $queryOne } from "../lib/dom.js";
import { _warn, openLogs } from "../lib/logger.js";
import { getUserEmail } from "../api-caller/apiCaller.js";
import { arrow_left, pen_solid, svg_trash, svg_logout, svg_menu, svg_list, svg_chart, svg_notes, svg_tag } from "../svg/svgFn.js";
import { closeSingleExercise, openExerciseForm, openExerciseList, openSingleExercise, submitExercise, submitExerciseBtn, tryDeleteExercise } from "./exercise-ui.js";
import { openSessionForm, submitSession, submitSet, tryDeleteSession } from "./set-ui.js";
import { openAnalytics } from "./analytics-ui.js";
import { openMuscles } from "./muscle-ui.js";
import { resetAuthMode } from "./auth-ui.js";
import { logout } from "../appBoot.js";
import { adjustRestTimer, skipRestTimer, clearRestTimer, isRestTimerEnabled, setRestTimerEnabled } from "./restTimer-ui.js";


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
const headerMenuPanel = $queryOne('#headerMenu .header-menu-panel');

function toggleHeaderMenu() {
  const opening = headerMenuPanel.classList.contains('display-none');
  headerMenuPanel.classList.toggle('display-none');
  // Refreshed on every open, not just once at boot, since logging out and
  // back in as a different account never reloads the page.
  if (opening) { refreshHeaderMenuEmail(); }
}

function closeHeaderMenu() {
  headerMenuPanel.classList.add('display-none');
}

function refreshHeaderMenuEmail() {
  $('headerMenuUserEmail').innerText = getUserEmail() || '';
}

function initUi() {
  // Go Back Button
  $button({
    appendTo: $('goBack2'),
    svgFn: arrow_left,
    listener: {
      fn: e => {
        switch (appState.currentView) {
          case 'SingleExercise':
            closeSingleExercise();
            break;
          case 'Muscles':
            openExerciseList();
            break;
          default: break;
        }
      }
    }
  });

  $button({
    appendTo: $('headerMenuBtn'),
    svgFn: svg_menu,
    listener: { fn: toggleHeaderMenu },
  });

  $button({
    class: 'horizontal',
    label: 'Músculos',
    svgFn: svg_tag,
    appendTo: $('musclesMenuBtn'),
    listener: { fn: () => openMuscles() },
  });

  $button({
    class: 'horizontal',
    label: 'Ver logs',
    svgFn: svg_notes,
    appendTo: $('viewLogsBtn'),
    listener: { fn: () => openLogs() },
  });

  // Built with plain $new (not $button) since this row needs a label *and*
  // a switch indicator, not $button's fixed icon+label shape. Reusing the
  // .btn.base-button classes still picks up the same .header-menu-item .btn
  // row styling (padding, full width, hover overlay) every other item gets.
  const restTimerSwitch = $new({ class: 'switch', children: [$new({ class: 'switch-knob' })] });
  restTimerSwitch.classList.toggle('on', isRestTimerEnabled());
  $('restTimerToggleBtn').append(
    $new({
      class: 'btn base-button horizontal',
      children: [
        $new({ class: 'label', text: 'Timer de descanso' }),
        restTimerSwitch,
      ],
    })
  );
  $('restTimerToggleBtn').addEventListener('click', () => {
    const enabled = !isRestTimerEnabled();
    setRestTimerEnabled(enabled);
    restTimerSwitch.classList.toggle('on', enabled);
    if (!enabled) { clearRestTimer(); } // turning it off immediately hides/stops anything currently running
  });

  $button({
    class: 'horizontal',
    label: 'Cerrar sesión',
    svgFn: svg_logout,
    appendTo: $('logoutBtn'),
    listener: {
      fn: async () => {
        await logout();
        resetAuthMode('login'); // always land back on the login form, not wherever the mode was left
      }
    }
  });

  // Bottom tab bar - navigation triggers wired purely through data-click-
  // action (see the delegation switch below), no per-button listener.
  $button({
    appendTo: $('tabExercisesBtn'),
    svgFn: svg_list,
    label: 'Ejercicios',
    class: 'tab-btn',
    dataset: [['clickAction', 'openExerciseList'], ['tab', 'exercises']],
  });
  $button({
    appendTo: $('tabAnalyticsBtn'),
    svgFn: svg_chart,
    label: 'Análisis',
    class: 'tab-btn',
    dataset: [['clickAction', 'openAnalytics'], ['tab', 'analytics']],
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
    // Borrar Ejercicio
    listener: { fn: tryDeleteExercise },
    svgFn: svg_trash,
    appendTo: $queryOne('#singleExerciseView .delete-btn'),
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

  // Close the header menu on any click outside it - the hamburger button
  // itself is inside #headerMenu, so the same click that opens the menu
  // can't also immediately close it here.
  $('app').addEventListener('click', e => {
    if (headerMenuPanel.classList.contains('display-none')) { return; }
    if (!(e.target instanceof Element) || !e.target.closest('#headerMenu')) {
      closeHeaderMenu();
    }
  });

  // Every menu item is a one-shot action (view logs, log out) rather than
  // something that opens further UI the menu needs to stay open behind - so
  // any click inside the panel closes it too, instead of requiring each
  // item's own handler to remember to.
  headerMenuPanel.addEventListener('click', closeHeaderMenu);

  // Click Event Delegation
  $('app').addEventListener('click', e => {
    const target = e.target;
    if (!target) { return; }
    if (target instanceof HTMLInputElement) {
      target.select();
      return;
    }
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
      case 'openExerciseList':
        openExerciseList();
        break;
      case 'openAnalytics':
        openAnalytics();
        break;
      case 'adjustRestTimer':
        adjustRestTimer(Number(dataset.delta));
        break;
      case 'skipRestTimer':
        skipRestTimer();
        break;
      default:
        return _warn(' :: clickAction not defined: ' + dataset.clickAction);
    }
  });
}

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


export { initUi, pageTitle };
