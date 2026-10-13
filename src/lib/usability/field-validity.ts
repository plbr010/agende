export const REQUIRED_FIELD_MESSAGE = "Preencha este campo para continuar.";

export function applyPortugueseValidity(field: HTMLInputElement | HTMLTextAreaElement) {
  if (field.validity.valueMissing) {
    field.setCustomValidity(REQUIRED_FIELD_MESSAGE);
    return;
  }
  if (field.validity.typeMismatch && field.type === "email") {
    field.setCustomValidity("Digite um e-mail válido, como ana@email.com.");
    return;
  }
  if (field.validity.tooShort) {
    field.setCustomValidity(`Use no mínimo ${field.minLength} caracteres.`);
    return;
  }
  field.setCustomValidity("");
}
