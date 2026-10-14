import assert from "node:assert/strict";
import test from "node:test";
import { CLIPBOARD_COPY, copyTextToClipboard } from "./clipboard";

test("copyTextToClipboard succeeds via the clipboard API and trims the value", async () => {
  const writes: string[] = [];
  const previous = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      clipboard: {
        writeText: async (value: string) => {
          writes.push(value);
        },
      },
    },
  });
  try {
    assert.equal(await copyTextToClipboard(" https://agendeapp.online/p/x "), true);
    assert.deepEqual(writes, ["https://agendeapp.online/p/x"]);
  } finally {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: previous });
  }
});

test("copyTextToClipboard does not claim success when the clipboard rejects", async () => {
  const previous = globalThis.navigator;
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      clipboard: {
        writeText: async () => {
          throw new Error("denied");
        },
      },
    },
  });
  try {
    assert.equal(await copyTextToClipboard("abc"), false);
    assert.match(CLIPBOARD_COPY.failure, /copie manualmente/i);
  } finally {
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: previous });
  }
});
