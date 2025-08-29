import { _log } from "./logger.js";

/**
 * Returns a "time ago" string.
 * @param {string | Date} input 
 * @returns {string}
 */
function timeAgo(input = '') {
    const date = (input instanceof Date) ? input : new Date(input);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (isNaN(seconds)) { return "¡!"; }
    const daysPassed = Math.floor(seconds / 60 / 60 / 24)

    if (daysPassed < 1) { return "hoy" }
    if (daysPassed === 1) { return "ayer" }
    const labels = [
        { label: 'año', days: 365 },
        { label: 'mes', pl: 'es', days: 30 },
        { label: 'semana', days: 7 },
        { label: 'día', days: 1 },
    ]

    for (const { label, pl, days } of labels) {
        if (daysPassed < days) { continue }
        const amount = Math.floor(daysPassed / days)
        const remainder = daysPassed % days
        return `${amount} ${label}` + (amount > 1 ? (pl || 's') : '') + (remainder ? '+' : '')
    }

    return '¿?'
}


/**
 * @param {Date} date
 * @returns {string}
 */
function toYYYYMMDD(date) {
    let strYear = date.getFullYear().toString();

    const month = date.getMonth() + 1;
    let strMonth = month.toString();
    if (month < 10) strMonth = '0' + strMonth;

    const day = date.getDate();
    let strDay = day.toString();
    if (day < 10) strDay = '0' + strDay;

    return strYear + '-' + strMonth + '-' + strDay;
}


export { timeAgo, toYYYYMMDD }