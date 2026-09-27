import assert from "node:assert/strict";
import test from "node:test";
import { resolvePeriod, todayInTimezone } from "./periods";
import { mutationSchema, parseMutation } from "./mutations";
import { trialDaysRemaining, planSchema } from "@/lib/billing/plans";
import { PLANS } from "@/lib/marketing/content";

test("periods are inclusive, handle leap years and previous-year transitions", () => {
  for (const [value, start, end] of [
    ["today", "2026-01-02", "2026-01-02"],
    ["7d", "2025-12-27", "2026-01-02"],
    ["30d", "2025-12-04", "2026-01-02"],
    ["month", "2026-01-01", "2026-01-02"],
    ["previous", "2025-12-01", "2025-12-31"],
  ]) {
    const result = resolvePeriod(value, "2026-01-02");
    assert.equal(result.startDate, start);
    assert.equal(result.endDate, end);
  }
  assert.equal(resolvePeriod("previous", "2024-03-31").endDate, "2024-02-29");
  assert.equal(resolvePeriod("nonsense", "2026-09-26").period, "month");
  assert.equal(resolvePeriod(["today", "7d"], "2026-09-26").period, "month");
});
test("periods use the business timezone near midnight", () => {
  const now = new Date("2026-09-26T02:30:00Z");
  assert.equal(todayInTimezone("America/Sao_Paulo", now), "2026-09-25");
  assert.equal(todayInTimezone("America/Noronha", now), "2026-09-26");
});
test("plan selection is limited to the catalog and remaining days never go negative", () => {
  for (const plan of PLANS) assert.equal(planSchema.parse(plan.id), plan.id);
  assert.equal(planSchema.safeParse("premium").success, false);
  assert.equal(planSchema.safeParse(null).success, false);
  assert.deepEqual(PLANS.map(p => p.annualPrice), ["R$ 799/ano", "R$ 1.499/ano", "R$ 2.799/ano"]);
  assert.equal(trialDaysRemaining("2026-09-08T00:00:00Z", Date.parse("2026-09-01T00:00:00Z")), 7);
  assert.equal(trialDaysRemaining("2026-09-08T00:00:00Z", Date.parse("2026-09-09T00:00:00Z")), 0);
});
const id = "10000000-0000-4000-8000-000000000001";
test("stock requires meaningful quantities, but adjustment may set zero", () => {
  const base = {action: "movement", id, reason: "Contagem", quantity: "0"};
  assert.equal(mutationSchema.safeParse({...base, type: "exit"}).success, false);
  assert.equal(mutationSchema.safeParse({...base, type: "entry"}).success, false);
  assert.equal(mutationSchema.safeParse({...base, type: "adjustment"}).success, true);
  assert.equal(mutationSchema.safeParse({...base, type: "adjustment", quantity: ""}).success, false);
  assert.equal(mutationSchema.safeParse({...base, type: "entry", quantity: "-1"}).success, false);
});
test("package form maps only selected services and refuses an empty package", () => {
  const form = new FormData();
  for (const [key,value] of Object.entries({action:"package-create", name:"Cuidado", description:"",amount:"89,90",validity:"30"})) form.set(key,value);
  assert.equal(parseMutation(form).success,false);
  form.append("service",id); form.set("sessions-"+id,"3");
  const parsed=parseMutation(form);
  assert.equal(parsed.success,true);
  if(parsed.success && parsed.data.action === "package-create") {
    assert.equal(parsed.data.amount,8990);
    assert.deepEqual(parsed.data.items,[{service_id:id,quantity:3}]);
  }
});
test("refund requires explicit confirmation, valid amount and a reason", () => {
  const input={action:"finance-refund",id,amount:"12,50",reason:"Devolução",method:"pix",key:id};
  assert.equal(mutationSchema.safeParse(input).success,false);
  assert.equal(mutationSchema.safeParse({...input,confirmed:"on"}).success,true);
  assert.equal(mutationSchema.safeParse({...input,confirmed:"on",amount:"0"}).success,false);
  assert.equal(mutationSchema.safeParse({...input,confirmed:"on",reason:""}).success,false);
});
