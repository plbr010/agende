/** Copy text without claiming success when the browser refuses access. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const value = text.trim();
  if (!value) return false;

  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Fall through to the older selection path used on some mobile browsers.
    }
  }

  if (typeof document === "undefined") return false;
  try {
    const input = document.createElement("textarea");
    input.value = value;
    input.setAttribute("readonly", "");
    input.style.position = "fixed";
    input.style.left = "-9999px";
    document.body.appendChild(input);
    input.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(input);
    return ok;
  } catch {
    return false;
  }
}

export const CLIPBOARD_COPY = {
  success: "Link copiado. Cole no WhatsApp para enviar.",
  inviteSuccess: "Link copiado.",
  failure: "Não foi possível copiar. Selecione o link e copie manualmente.",
} as const;
