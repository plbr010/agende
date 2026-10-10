import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  BOOKING_STEP_PROMPT,
  FORBIDDEN_USER_FACING_PATTERNS,
  STATUS_ACTION_LABEL,
  bookingStepCaption,
  shouldSkipProfessionalStep,
} from "./copy";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");

const USER_FACING_FILES = [
  "src/components/auth/signup-form.tsx",
  "src/components/auth/login-form.tsx",
  "src/components/workspace/create-workspace-form.tsx",
  "src/app/app/page.tsx",
  "src/components/agenda/agenda-board.tsx",
  "src/components/agenda/availability-editor.tsx",
  "src/components/booking/public-booking-flow.tsx",
  "src/components/catalog/directories.tsx",
  "src/components/finance/finance-dashboard.tsx",
  "src/components/client/workspace-finder.tsx",
  "src/components/workspace/team-admin.tsx",
];

test("status actions use verbs a person can tap without guessing", () => {
  assert.equal(STATUS_ACTION_LABEL.confirmed, "Confirmar cliente");
  assert.equal(STATUS_ACTION_LABEL.in_progress, "Começar atendimento");
  assert.equal(STATUS_ACTION_LABEL.completed, "Finalizar atendimento");
  assert.equal(STATUS_ACTION_LABEL.cancelled, "Cancelar horário");
  assert.equal(STATUS_ACTION_LABEL.no_show, "Cliente não veio");
});

test("booking captions name the current step in plain language", () => {
  assert.equal(bookingStepCaption("date", 2, 5), "Passo 3 de 5: Escolha o dia");
  assert.equal(BOOKING_STEP_PROMPT.confirm, "Confirme a reserva");
});

test("a single professional is skipped so the client does not choose from one option", () => {
  assert.equal(shouldSkipProfessionalStep(1), true);
  assert.equal(shouldSkipProfessionalStep(0), false);
  assert.equal(shouldSkipProfessionalStep(2), false);
});

test("priority screens do not show jargon that blocks first use", () => {
  for (const relative of USER_FACING_FILES) {
    const quoted = readFileSync(join(root, relative), "utf8");
    for (const pattern of FORBIDDEN_USER_FACING_PATTERNS) {
      assert.equal(
        pattern.test(quoted),
        false,
        `${relative} still contains ${pattern}`,
      );
    }
  }
});
