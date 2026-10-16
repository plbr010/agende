import { prepareAppointmentWhatsApp } from "@/lib/agenda/whatsapp-actions";
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const result = await prepareAppointmentWhatsApp(id);
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" };
  if (!result.url) return new Response(result.error ?? "Mensagem indisponível. Volte à agenda e tente novamente.", { status: 422, headers });
  return new Response(null, { status: 302, headers: { ...headers, Location: result.url } });
}
