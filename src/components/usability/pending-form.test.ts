import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function source(relative: string) {
  return readFileSync(join(root, relative), "utf8");
}

test("sensitive one-click actions lock while the request is in flight", () => {
  const helper = source("src/components/usability/pending-form.tsx");
  assert.match(helper, /useTransition/);
  assert.match(helper, /if \(pending\) return/);

  const team = source("src/components/workspace/team-admin.tsx");
  assert.match(team, /PendingForm/);
  assert.match(team, /copyTextToClipboard/);
  assert.match(team, /CLIPBOARD_COPY\.failure/);
  assert.doesNotMatch(team, /navigator\.clipboard\.writeText/);

  const services = source("src/components/catalog/directories.tsx");
  assert.match(services, /togglePending/);
  assert.match(services, /disabled=\{togglePending\}/);

  const agenda = source("src/components/agenda/agenda-board.tsx");
  assert.match(agenda, /statusPending/);
  assert.match(agenda, /disabled=\{statusPending\}/);
});
