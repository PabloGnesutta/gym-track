import { $, $getInner, $new, show, hide } from "../lib/dom.js";
import { remainingSeconds, formatRestTime, clampDuration } from "../lib/restTimer.js";

const DEFAULT_DURATION = 90;
const TICK_MS = 250;
const DONE_HIDE_DELAY_MS = 4000;
const DONE_LABEL = '¡Descanso terminado!';
const RESTING_LABEL = 'Descanso';

const singleExerciseView = $('singleExerciseView');
const restTimerEl = $getInner(singleExerciseView, '.rest-timer');

let endAt = 0;
let intervalId = 0;
let hideTimeoutId = 0;
/** @type {HTMLElement | null} */
let timeEl = null;
/** @type {HTMLElement | null} */
let labelEl = null;

/**
 * @returns {boolean}
 */
function isRestTimerEnabled() {
  return localStorage.getItem('restTimerEnabled') !== 'false';
}

/**
 * @param {boolean} enabled
 */
function setRestTimerEnabled(enabled) {
  localStorage.setItem('restTimerEnabled', String(enabled));
}

function lastUsedDuration() {
  const stored = Number(localStorage.getItem('restTimerDuration'));
  return Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_DURATION;
}

/**
 * Auto-started after logging a set. No-ops entirely if the user has
 * disabled the feature via the header-menu toggle.
 * @param {number} [seconds]
 */
function startRestTimer(seconds) {
  if (!isRestTimerEnabled()) { return; }

  clearInterval(intervalId);
  clearTimeout(hideTimeoutId);

  const duration = clampDuration(seconds ?? lastUsedDuration());
  endAt = Date.now() + duration * 1000;
  localStorage.setItem('restTimerDuration', String(duration));

  restTimerEl.innerHTML = '';
  labelEl = $new({ class: 'rest-timer-label', text: RESTING_LABEL });
  timeEl = $new({ class: 'rest-timer-time', text: formatRestTime(duration) });
  const controls = $new({
    class: 'rest-timer-controls',
    children: [
      $new({ class: 'rest-timer-btn', text: '-15s', dataset: [['clickAction', 'adjustRestTimer'], ['delta', '-15']] }),
      $new({ class: 'rest-timer-btn', text: '+15s', dataset: [['clickAction', 'adjustRestTimer'], ['delta', '15']] }),
      $new({ class: 'rest-timer-btn', text: 'Saltar', dataset: [['clickAction', 'skipRestTimer']] }),
    ],
  });
  restTimerEl.classList.remove('done');
  restTimerEl.append(labelEl, timeEl, controls);
  show(restTimerEl);

  intervalId = window.setInterval(tick, TICK_MS);
}

function tick() {
  const remaining = remainingSeconds(endAt, Date.now());
  if (remaining <= 0) {
    finish();
    return;
  }
  if (timeEl) { timeEl.innerText = formatRestTime(remaining); }
}

function finish() {
  clearInterval(intervalId);
  if (labelEl) { labelEl.innerText = DONE_LABEL; }
  if (timeEl) { timeEl.innerText = formatRestTime(0); }
  restTimerEl.classList.add('done');
  navigator.vibrate?.([200, 100, 200]);
  hideTimeoutId = window.setTimeout(() => hide(restTimerEl), DONE_HIDE_DELAY_MS);
}

/**
 * @param {number} deltaSeconds
 */
function adjustRestTimer(deltaSeconds) {
  if (!intervalId) { return; } // no timer currently running
  const duration = clampDuration(remainingSeconds(endAt, Date.now()) + deltaSeconds);
  endAt = Date.now() + duration * 1000;
  localStorage.setItem('restTimerDuration', String(duration));
  if (timeEl) { timeEl.innerText = formatRestTime(duration); }
}

function skipRestTimer() {
  clearRestTimer();
}

/**
 * Stops and hides the timer with no completion fanfare - used both by the
 * "Saltar" control and whenever the Single Exercise view is (re)populated,
 * so a previous exercise's timer never bleeds into a newly opened one.
 */
function clearRestTimer() {
  clearInterval(intervalId);
  clearTimeout(hideTimeoutId);
  intervalId = 0;
  hide(restTimerEl);
  restTimerEl.classList.remove('done');
}

export {
  startRestTimer, adjustRestTimer, skipRestTimer, clearRestTimer,
  isRestTimerEnabled, setRestTimerEnabled,
};
