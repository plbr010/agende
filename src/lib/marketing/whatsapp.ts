export const SPECIALIST_MESSAGE = "Olá! Conheci o Agendê e gostaria de conversar com um especialista para conhecer melhor a plataforma e entender como ela pode ajudar meu negócio.";

export function specialistWhatsAppHref(number: string | undefined): string | null {
  const digits = number?.trim();
  // Explicit international Brazilian number; never infer or invent a destination.
  if (!digits || !/^55[1-9][0-9]{9,10}$/.test(digits)) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(SPECIALIST_MESSAGE)}`;
}
