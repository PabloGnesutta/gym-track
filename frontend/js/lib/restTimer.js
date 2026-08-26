const MIN_DURATION = 15;
const MAX_DURATION = 600;

/**
 * Seconds remaining until `endAtMs`, measured from `nowMs` - always
 * recomputed from the absolute end timestamp rather than decremented, so a
 * throttled/backgrounded tab's late ticks self-correct instead of drifting.
 * @param {number} endAtMs
 * @param {number} nowMs
 */
function remainingSeconds(endAtMs, nowMs) {
  return Math.max(0, Math.ceil((endAtMs - nowMs) / 1000));
}

/**
 * @param {number} seconds
 * @returns {string} "m:ss" - minutes unpadded, seconds zero-padded.
 */
function formatRestTime(seconds) {
  const clamped = Math.max(0, seconds);
  const minutes = Math.floor(clamped / 60);
  const secs = clamped % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * @param {number} seconds
 */
function clampDuration(seconds) {
  return Math.min(MAX_DURATION, Math.max(MIN_DURATION, seconds));
}

export { remainingSeconds, formatRestTime, clampDuration };
