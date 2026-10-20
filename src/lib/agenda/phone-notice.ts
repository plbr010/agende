import { internationalPhoneDigits } from "@/lib/validation/international-phone";

/** Explains why WhatsApp cannot open. Does not authorize the contact. */
export function clientPhoneNotice(phone: string | null | undefined): string | null {
  if (!phone?.trim()) {
    return "Este cliente não tem telefone cadastrado. Não dá para abrir o WhatsApp.";
  }
  if (!internationalPhoneDigits(phone)) {
    return "O telefone não está no formato internacional, com o sinal de +. Corrija o cadastro antes de abrir o WhatsApp. A mensagem ainda pode ser copiada.";
  }
  return null;
}
