import { specialistWhatsAppHref } from "@/lib/marketing/whatsapp";

export function SpecialistWhatsApp() {
  const href = specialistWhatsAppHref(process.env.NEXT_PUBLIC_AGENDE_WHATSAPP_NUMBER);
  if (!href) return null;
  return <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 max-w-full items-center justify-center gap-2 rounded-full border border-primary/25 bg-background px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary">
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5 shrink-0" aria-hidden="true"><path d="M20.5 3.5A11.9 11.9 0 0 0 12 0 12 12 0 0 0 1.6 18L0 24l6.2-1.6A12 12 0 0 0 24 12c0-3.2-1.2-6.2-3.5-8.5ZM12 22a10 10 0 0 1-5.1-1.4l-.4-.2-3.7 1 1-3.6-.3-.4A10 10 0 1 1 12 22Zm5.5-7.5c-.3-.1-1.8-.9-2.1-1-.3-.1-.5-.1-.7.2l-1 1.2c-.2.2-.4.2-.7.1a8.2 8.2 0 0 1-4-3.5c-.3-.5.3-.5.9-1.6.1-.2 0-.4 0-.6l-1-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4a3.8 3.8 0 0 0-1.2 2.8c0 1.6 1.2 3.2 1.4 3.4.1.2 2.4 3.7 5.8 5.2 2.1.9 2.9 1 3.9.8.6-.1 1.8-.8 2.1-1.5.2-.7.2-1.3.2-1.5-.1-.2-.3-.3-.6-.4Z" /></svg>
    <span>Fale com um especialista</span>
  </a>;
}
