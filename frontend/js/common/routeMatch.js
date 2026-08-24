/**
 * @typedef {{ view: 'ExerciseList' } | { view: 'SingleExercise', exerciseKey: string } | { view: 'Analytics' } | { view: 'Muscles' }} Route
 */

/**
 * Maps a URL pathname to the view it represents. Kept free of DOM/app
 * imports (unlike router.js, which wires this into history + the view
 * functions) so the matching logic itself can be unit tested in plain Node.
 * @param {string} pathname
 * @returns {Route}
 */
function parseRoute(pathname) {
  const exerciseMatch = pathname.match(/^\/exercise\/([^/]+)\/?$/);
  if (exerciseMatch) { return { view: 'SingleExercise', exerciseKey: exerciseMatch[1] }; }
  if (pathname.match(/^\/analytics\/?$/)) { return { view: 'Analytics' }; }
  if (pathname.match(/^\/muscles\/?$/)) { return { view: 'Muscles' }; }
  return { view: 'ExerciseList' };
}

export { parseRoute };
