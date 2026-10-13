export const REQUIRED_FIELD_MESSAGE = "Preencha este campo para continuar.";

export type ValidityTarget = {
  type: string;
  minLength: number;
  validity: Pick<ValidityState, "valueMissing" | "typeMismatch" | "tooShort">;
  setCustomValidity: (message: string) => void;
};

export function applyPortugueseValidity(field: ValidityTarget) {
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
