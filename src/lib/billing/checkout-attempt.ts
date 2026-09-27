export type CheckoutAttempt = { selection: string; key: string } | null;

// Reuse retries of one selection, but never reuse an expired session's key
// after selecting a different plan or interval and then returning.
export function nextCheckoutAttempt(previous: CheckoutAttempt, selection: string,
  createKey: () => string): NonNullable<CheckoutAttempt> {
  return previous?.selection === selection ? previous : { selection, key: createKey() };
}
