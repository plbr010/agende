export type ConfirmView = {
  open: boolean;
  pending: boolean;
  error: string | null;
};

export const CONFIRM_FAILURE_MESSAGE = "Não deu certo. Nada foi alterado. Tente de novo.";

const TECHNICAL_FAILURE =
  /(\b(error|exception|undefined|null|failed to fetch|jwt|supabase|pgrst|stack)\b|\b\d{2}[0-9A-Z]{3}\b|ECONN|TypeError|SyntaxError)/i;

export function messageFromConfirmFailure(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : typeof cause === "string" ? cause : "";
  const message = raw.trim();
  if (!message || TECHNICAL_FAILURE.test(message)) {
    return CONFIRM_FAILURE_MESSAGE;
  }
  return message;
}

export function openConfirm(view: ConfirmView): ConfirmView {
  if (view.pending) return view;
  return { open: true, pending: false, error: null };
}

export function requestClose(view: ConfirmView): ConfirmView {
  if (view.pending) return view;
  return { open: false, pending: false, error: null };
}

export function startConfirm(view: ConfirmView): { view: ConfirmView; accepted: boolean } {
  if (!view.open || view.pending) {
    return { view, accepted: false };
  }
  return { view: { open: true, pending: true, error: null }, accepted: true };
}

export function succeedConfirm(): ConfirmView {
  return { open: false, pending: false, error: null };
}

export function failConfirm(view: ConfirmView, cause: unknown): ConfirmView {
  return {
    open: true,
    pending: false,
    error: messageFromConfirmFailure(cause),
  };
}
