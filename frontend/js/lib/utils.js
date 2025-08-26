/**
 * Returns a random integer between min and max (both inclusive).
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} A random integer between min and max.
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Clears the array of items.
 * Use this instead of the assignment operator (arr = [])
 * to keep any references to the array valid.
 * @param {Array} arr
*/
function clearArray(arr) {
  while (arr.length) arr.splice(0);
}

/**
 * Delete all properties in the object, keeping references intact
 * @param {Record<string, *>} obj
 * @param {string[]} omit - Do not delete the exceptions
 */
function clearObj(obj, omit = []) {
  for (const prop in obj) {
    if (!(omit.includes(prop))) {
      delete obj[prop];
    }
  }
}


export { randomInt, clearArray, clearObj };