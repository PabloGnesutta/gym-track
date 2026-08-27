import { $, $button, $display, $form, $getInner, $queryOne, $queryOneInput, $undisplay } from "../lib/dom.js";
import { _error } from "../lib/logger.js";
import { showAlert } from "../lib/dialog.js";
import { apiLogin, apiRequestPasswordReset, apiResetPassword, apiSignup } from "../api-caller/apiCaller.js";
import { afterLogin } from "../appBoot.js";


const authForm = $form('authForm');
const authNameField = $('authNameField');
const authEmailField = $('authEmailField');
const authPasswordField = $('authPasswordField');
const authNewPasswordField = $('authNewPasswordField');
const authNewPasswordConfirmField = $('authNewPasswordConfirmField');
const authNameInput = $queryOneInput('#authForm input[name="authName"]');
const authEmailInput = $queryOneInput('#authForm input[name="authEmail"]');
const authPasswordInput = $queryOneInput('#authForm input[name="authPassword"]');
const authNewPasswordInput = $queryOneInput('#authForm input[name="authNewPassword"]');
const authNewPasswordConfirmInput = $queryOneInput('#authForm input[name="authNewPasswordConfirm"]');
const authFormTitle = $getInner(authForm, '.form-title-text');
const authModeToggle = $('authModeToggle');
const authForgotPasswordBtn = $('authForgotPasswordBtn');

/** @typedef {'login' | 'signup' | 'forgot' | 'reset'} AuthMode */
/** @type {AuthMode} */
let mode = 'login';

/** Set once, if the page loaded with a `?resetToken=` query param. */
let resetToken = '';

// Intercept native form submission (e.g. pressing Enter in a field) so it
// doesn't navigate the browser away with the fields as a GET query string.
authForm.addEventListener('submit', submitAuthForm);
authModeToggle.addEventListener('click', () => setMode(mode === 'signup' ? 'login' : 'signup'));
authForgotPasswordBtn.addEventListener('click', () => setMode('forgot'));

/**
 * Wires the login/signup/forgot-password/reset-password form. The header's
 * logout button itself is wired in ui.js (where every other header/view
 * button is), but calls back into resetAuthMode() here so a fresh logout
 * always lands on the login form.
 *
 * If the page loaded with a `?resetToken=` query param (a password-reset
 * email link - see appBoot.js's bootApp(), which forces authStage to
 * 'login' for this same case even if a session already exists), goes
 * straight to 'reset' mode instead of 'login', and strips the token from
 * the URL so a refresh doesn't keep resubmitting it.
 */
function initAuthUi() {
  $button({
    label: 'Iniciar Sesión',
    appendTo: $queryOne('#authForm .submit'),
    listener: { fn: submitAuthForm },
  });

  const params = new URLSearchParams(location.search);
  const token = params.get('resetToken');
  if (token) {
    resetToken = token;
    history.replaceState(null, '', location.pathname);
    setMode('reset');
  } else {
    setMode('login');
  }
}

/**
 * @param {AuthMode} newMode
 */
function setMode(newMode) {
  mode = newMode;
  const submitLabel = $getInner($queryOne('#authForm .submit'), '.label');

  const showName = mode === 'signup';
  const showEmail = mode === 'login' || mode === 'signup' || mode === 'forgot';
  const showPassword = mode === 'login' || mode === 'signup';
  const showNewPassword = mode === 'reset';
  const showForgotLink = mode === 'login';
  const showModeToggle = mode === 'login' || mode === 'signup';

  showName ? $display('authNameField') : $undisplay('authNameField');
  showEmail ? $display('authEmailField') : $undisplay('authEmailField');
  showPassword ? $display('authPasswordField') : $undisplay('authPasswordField');
  showNewPassword ? $display('authNewPasswordField') : $undisplay('authNewPasswordField');
  showNewPassword ? $display('authNewPasswordConfirmField') : $undisplay('authNewPasswordConfirmField');
  showForgotLink ? $display('authForgotPasswordBtn') : $undisplay('authForgotPasswordBtn');
  showModeToggle ? $display('authModeToggle') : $undisplay('authModeToggle');

  if (mode === 'signup') {
    authFormTitle.innerText = 'Crear Cuenta';
    submitLabel.innerText = 'Crear Cuenta';
    authModeToggle.innerText = '¿Ya tenés cuenta? Iniciá sesión';
  } else if (mode === 'forgot') {
    authFormTitle.innerText = 'Restablecer Contraseña';
    submitLabel.innerText = 'Enviar Link';
  } else if (mode === 'reset') {
    authFormTitle.innerText = 'Elegir Nueva Contraseña';
    submitLabel.innerText = 'Guardar Contraseña';
  } else {
    authFormTitle.innerText = 'Iniciar Sesión';
    submitLabel.innerText = 'Iniciar Sesión';
    authModeToggle.innerText = '¿No tenés cuenta? Creá una';
  }
}

/**
 * @param {Event} e
 */
async function submitAuthForm(e) {
  e.preventDefault();

  if (mode === 'forgot') { return submitForgotPassword(); }
  if (mode === 'reset') { return submitResetPassword(); }

  const email = authEmailInput.value.trim();
  const password = authPasswordInput.value;
  if (!email || !password) { return; }

  const result = mode === 'signup'
    ? await apiSignup(email, password, authNameInput.value.trim())
    : await apiLogin(email, password);

  if (!result.data) { return _error(result.error); }

  authForm.reset();
  await afterLogin();
}

async function submitForgotPassword() {
  const email = authEmailInput.value.trim();
  if (!email) { return; }

  await apiRequestPasswordReset(email);
  authForm.reset();
  setMode('login');
  await showAlert({
    title: 'Revisá tu email',
    message: 'Si el email existe, te enviamos un link para restablecer tu contraseña.',
  });
}

async function submitResetPassword() {
  const newPassword = authNewPasswordInput.value;
  const confirmPassword = authNewPasswordConfirmInput.value;
  if (!newPassword || !confirmPassword) { return; }

  if (newPassword !== confirmPassword) {
    return showAlert({ title: 'Error', message: 'Las contraseñas no coinciden' });
  }

  const result = await apiResetPassword(resetToken, newPassword);
  if (!result.data) {
    return showAlert({ title: 'Error', message: result.error || 'No se pudo restablecer la contraseña' });
  }

  authForm.reset();
  setMode('login');
  await showAlert({
    title: 'Contraseña actualizada',
    message: 'Iniciá sesión con tu nueva contraseña.',
  });
}


export { initAuthUi, setMode as resetAuthMode };
