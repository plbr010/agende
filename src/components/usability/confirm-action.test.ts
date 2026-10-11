import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CONFIRM_FAILURE_MESSAGE,
  failConfirm,
  messageFromConfirmFailure,
  openConfirm,
  requestClose,
  startConfirm,
  succeedConfirm,
  type ConfirmView,
} from "./confirm-state";

const closed: ConfirmView = { open: false, pending: false, error: null };

test("opening and closing a confirmation ignores clicks while it is saving", () => {
  const open = openConfirm(closed);
  assert.deepEqual(open, { open: true, pending: false, error: null });

  const started = startConfirm(open);
  assert.equal(started.accepted, true);
  assert.equal(started.view.pending, true);

  assert.deepEqual(requestClose(started.view), started.view);
  assert.deepEqual(openConfirm(started.view), started.view);
  assert.equal(startConfirm(started.view).accepted, false);
  assert.equal(startConfirm(closed).accepted, false);
});

test("a failed confirmation stays open with a plain message", () => {
  const pending = startConfirm(openConfirm(closed)).view;
  const failed = failConfirm(pending, new Error("Você não pode alterar os horários desta profissional."));
  assert.equal(failed.open, true);
  assert.equal(failed.pending, false);
  assert.equal(failed.error, "Você não pode alterar os horários desta profissional.");

  const technical = failConfirm(pending, new Error("duplicate key value violates exclusion constraint 23P01"));
  assert.equal(technical.open, true);
  assert.equal(technical.error, CONFIRM_FAILURE_MESSAGE);
  assert.equal(messageFromConfirmFailure("Failed to fetch"), CONFIRM_FAILURE_MESSAGE);
  assert.equal(messageFromConfirmFailure(""), CONFIRM_FAILURE_MESSAGE);
});

test("a completed confirmation closes and clears the error", () => {
  const failed = failConfirm(startConfirm(openConfirm(closed)).view, new Error("Tente de novo."));
  assert.deepEqual(requestClose(failed), closed);
  assert.deepEqual(succeedConfirm(), closed);
});

test("confirmation opens from a dialog trigger button, not a clickable span", () => {
  const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "confirm-action.tsx"), "utf8");
  assert.match(source, /DialogTrigger/);
  assert.match(source, /initialFocus=\{titleRef\}/);
  assert.match(source, /role="alert"/);
  assert.match(source, /aria-busy=\{view\.pending\}/);
  assert.match(source, /startConfirm/);
  assert.match(source, /failConfirm/);
  assert.match(source, /lock\.current/);
  assert.doesNotMatch(source, /<span[\s\S]*onClick/);
  assert.doesNotMatch(source, /<button[\s\S]*<button/);
});
