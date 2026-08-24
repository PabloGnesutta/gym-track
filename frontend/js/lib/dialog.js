import { $, $getInner, display, undisplay } from "./dom.js";


const dialogOverlay = $('dialogOverlay');
const dialogTitle = $getInner(dialogOverlay, '.dialog-title');
const dialogMessage = $getInner(dialogOverlay, '.dialog-message');
/** @type {HTMLButtonElement} */ // @ts-ignore
const dialogConfirmBtn = $('dialogConfirmBtn');
/** @type {HTMLButtonElement} */ // @ts-ignore
const dialogCancelBtn = $('dialogCancelBtn');
const dialogBackdrop = $getInner(dialogOverlay, '.dialog-backdrop');

/** @type {((result: boolean) => void) | null} */
let resolveActive = null;

/** @param {boolean} result */
function closeDialog(result) {
  undisplay(dialogOverlay);
  const resolve = resolveActive;
  resolveActive = null;
  if (resolve) { resolve(result); }
}

dialogConfirmBtn.addEventListener('click', () => closeDialog(true));
dialogCancelBtn.addEventListener('click', () => closeDialog(false));
dialogBackdrop.addEventListener('click', () => closeDialog(false));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && resolveActive) { closeDialog(false); }
});

/**
 * Replaces every native confirm() call in the app - resolves true if
 * confirmed, false if cancelled/backdrop-clicked/Escaped.
 * @param {{title?: string, message: string, confirmLabel?: string, cancelLabel?: string}} opts
 * @returns {Promise<boolean>}
 */
function showConfirm({ title = '', message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar' }) {
  if (resolveActive) { closeDialog(false); } // this app never stacks dialogs
  dialogTitle.innerText = title;
  dialogTitle.classList.toggle('display-none', !title);
  dialogMessage.innerText = message;
  dialogConfirmBtn.innerText = confirmLabel;
  dialogCancelBtn.innerText = cancelLabel;
  display(dialogCancelBtn);
  display(dialogOverlay);
  return new Promise(resolve => { resolveActive = resolve; });
}

/**
 * Replaces every native alert() call in the app.
 * @param {{title?: string, message: string, okLabel?: string}} opts
 * @returns {Promise<void>}
 */
async function showAlert({ title = '', message, okLabel = 'Aceptar' }) {
  if (resolveActive) { closeDialog(false); }
  dialogTitle.innerText = title;
  dialogTitle.classList.toggle('display-none', !title);
  dialogMessage.innerText = message;
  dialogConfirmBtn.innerText = okLabel;
  undisplay(dialogCancelBtn);
  display(dialogOverlay);
  await new Promise(resolve => { resolveActive = () => resolve(undefined); });
}

export { showConfirm, showAlert };
