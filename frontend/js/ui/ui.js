import { revertHistory, setStateField } from "../common/common.js";
import { $, $button, $form, $queryOne } from "../lib/dom.js";
import { _log } from "../lib/logger.js";
import { createExercise } from "../local-db/exercise.js";


function initUi() {
  createSubmitExerciseBtn();
  createOpenExerciseFormBtn();

  $('main-modal').addEventListener('pointerup', e => revertHistory());
}

function createOpenExerciseFormBtn() {
  $button({
    label: 'Agregar nuevo ejercicio',
    class: 'main-btn',
    appendTo: $('main-screen'),
    listener: { fn: e => setStateField('creatingExercise', true) }
  });
}

function createSubmitExerciseBtn() {
  $button({
    label: 'Crear',
    class: 'submit-btn',
    appendTo: $queryOne('#createExerciseForm .form-content'),
    listener: { fn: submitExercise }
  });
  $button({
    label: 'Cancelar',
    // class: 'submit-btn',
    appendTo: $queryOne('#createExerciseForm .form-content'),
    listener: { fn: e => revertHistory() }
  });
}

/**
 * @param {Event} e 
 */
async function submitExercise(e) {
  e.preventDefault();
  const form = $form('createExerciseForm');
  const formData = new FormData(form);

  // @ts-ignore
  const result = await createExercise(formData.get('exerciseName') || '', formData.get('muscles') || '');
  _log(result);
  if (result.errorMsg) {
    alert(result.errorMsg);
    setStateField('creatingExercise', false);
  } else {
    alert('Ejercicio creado exitosamente');
    form.reset();
    setStateField('creatingExercise', false);
  }
}


export { initUi };