/**
 * Random integer between min and max
 * @param {*} min
 * @param {*} max
 * @returns {number}
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

export { randomInt }