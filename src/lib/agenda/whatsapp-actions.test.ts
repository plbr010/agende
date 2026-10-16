import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { appointmentWhatsAppMessage, whatsappAppointmentSchema } from "./whatsapp";
import { buildWhatsAppLink } from "@/lib/booking/calendar";
const id = "11111111-1111-4111-8111-111111111111";
function moduleFrom<T>(path: string, dependencies: Record<string, unknown>) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(path, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText,
    { exports, URL, Response, require(name: string) { if (name in dependencies) return dependencies[name]; throw Error(name); } });
  return exports as T;
}
test("WhatsApp preparation refuses invalid IDs, denied rows and server outages without leaking provider details", async () => {
  for (const scenario of ["invalid", "denied", "network"]) {
    let reads = 0;
    const action = moduleFrom<{ prepareAppointmentWhatsApp: (id: string) => Promise<{ error?: string; url?: string }> }>("src/lib/agenda/whatsapp-actions.ts", {
      "zod": { z }, "./whatsapp": { appointmentWhatsAppMessage, whatsappAppointmentSchema }, "@/lib/booking/calendar": { buildWhatsAppLink },
      "@/lib/supabase/server": { createClient: async () => {
        reads++; if (scenario === "network") throw Error("private provider payload");
        return { rpc: async (name: string) => { assert.equal(name, "get_appointment_whatsapp"); return { data: null, error: { message: "private data" } }; } };
      } },
    }).prepareAppointmentWhatsApp;
    const result = await action(scenario === "invalid" ? "bad" : id);
    assert.ok(result.error); assert.equal(result.url, undefined); assert.ok(!JSON.stringify(result).includes("private"));
    if (scenario === "invalid") assert.equal(reads, 0);
  }
});
test("manual WhatsApp redirect fetches current authorized data on every click; invalid phone offers guidance without redirect", async () => {
  let count = 0;
  const route = moduleFrom<{ GET: (r: Request) => Promise<Response> }>("src/app/api/appointments/whatsapp/route.ts", {
    "@/lib/agenda/whatsapp-actions": { prepareAppointmentWhatsApp: async (value: string) => {
      assert.equal(value, id); count++;
      return count === 1 ? { url: "https://wa.me/5532999999999?text=Mensagem" } : { error: "Cadastre um telefone internacional válido." };
    } },
  });
  const request = new Request(`https://staging.invalid/api/appointments/whatsapp?id=${id}`);
  const first = await route.GET(request); assert.equal(first.status, 302); assert.equal(first.headers.get("referrer-policy"), "no-referrer");
  assert.equal(first.headers.get("cache-control"), "private, no-store");
  const next = await route.GET(request); assert.equal(next.status, 422); assert.equal(next.headers.get("location"), null); assert.match(await next.text(), /telefone internacional/);
  assert.equal(count, 2);
});
