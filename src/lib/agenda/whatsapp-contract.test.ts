import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { appointmentWhatsAppDetails, appointmentWhatsAppMessage, whatsappAppointmentSchema } from "./whatsapp";
import { buildWhatsAppLink } from "@/lib/booking/calendar";
import { z } from "zod";
const id = "11111111-1111-4111-8111-111111111111";
const row = { clientName: "Maria da Silva", phone: "+55 (32) 99999-9999", workspaceName: "Salão Real", serviceName: "Corte", professionalName: "Ana", startsAt: "2026-10-17T01:30:00Z", timezone: "America/Sao_Paulo", status: "confirmed" as const };
test("authorized WhatsApp read model exposes full identity, validated E164, real status and salon-local time", () => {
  assert.deepEqual(appointmentWhatsAppDetails(row), { ...row, phoneE164: "+5532999999999", localDate: "2026-10-16", localTime: "22:30" });
  assert.equal(appointmentWhatsAppDetails({ ...row, phone: "32999999999" }).phoneE164, null);
  assert.equal(appointmentWhatsAppMessage(row), "Olá, Maria! 💗\n\nSeu agendamento no *Salão Real* está confirmado!\n\n✨ Serviço: Corte\n👤 Profissional: Ana\n📅 Data: 16 de outubro de 2026\n🕒 Horário: 22:30\n\nEstamos te esperando! 💕");
});
test("Cursor contract comes from exactly one authorized RPC and returns no personal data after denial", async () => {
  for (const denied of [false, true]) {
    let reads = 0;
    const dependencies: Record<string, unknown> = {
      zod: { z }, "./whatsapp": { appointmentWhatsAppDetails, appointmentWhatsAppMessage, whatsappAppointmentSchema }, "@/lib/booking/calendar": { buildWhatsAppLink },
      "@/lib/supabase/server": { createClient: async () => ({ rpc: async (name: string, args: unknown) => {
        reads++; assert.equal(name, "get_appointment_whatsapp"); assert.deepEqual(JSON.parse(JSON.stringify(args)), { p_appointment_id: id });
        return { data: denied ? null : row, error: denied ? { code: "42501" } : null };
      } }) },
    };
    const exports = {};
    runInNewContext(ts.transpileModule(readFileSync("src/lib/agenda/whatsapp-actions.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
      { exports, require(name: string) { assert.ok(name in dependencies); return dependencies[name]; } });
    const action = (exports as { prepareAppointmentWhatsApp: (id: string) => Promise<{ appointment?: unknown; message?: string; url?: string; error?: string }> }).prepareAppointmentWhatsApp;
    const result = await action(id); assert.equal(reads, 1);
    if (denied) { assert.ok(result.error); assert.equal(result.appointment, undefined); assert.equal(result.message, undefined); assert.equal(result.url, undefined); }
    else { assert.deepEqual(JSON.parse(JSON.stringify(result.appointment)), { id, ...appointmentWhatsAppDetails(row) }); assert.equal(new URL(result.url!).searchParams.get("text"), result.message); }
  }
});
