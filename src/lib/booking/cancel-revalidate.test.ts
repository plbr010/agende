import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

test("cancelMyAppointmentAction revalidates client and agenda paths", () => {
  const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
  const cancelBlock = source.slice(
    source.indexOf("export async function cancelMyAppointmentAction"),
    source.indexOf("export async function loadCatalogAction"),
  );
  assert.match(cancelBlock, /revalidatePath\("\/cliente"\)/);
  assert.match(cancelBlock, /revalidatePath\("\/cliente\/agendamentos"\)/);
  assert.match(cancelBlock, /revalidatePath\("\/app\/agenda"\)/);
});
