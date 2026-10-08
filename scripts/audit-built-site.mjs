import { spawn } from "node:child_process";

// Starts only the already-built local app, with synthetic configuration.
// GET probes cannot authenticate, book appointments or create Stripe objects.
const port = 3108;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_ci_placeholder", NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}` },
  stdio: ["ignore", "pipe", "pipe"],
});
try {
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Local server did not become ready")), 30_000);
    let output = "";
    function onData(chunk) {
      output += chunk.toString();
      if (output.includes("Ready in")) { clearTimeout(timeout); resolve(); }
    }
    server.stdout.on("data", onData);
    server.stderr.on("data", chunk => { process.stderr.write(chunk); onData(chunk); });
    server.once("error", error => { clearTimeout(timeout); reject(error); });
    server.once("exit", code => { clearTimeout(timeout); reject(new Error(`Local server exited with ${code}`)); });
  });
  const audit = spawn(process.execPath, ["scripts/audit-preview.mjs", `http://127.0.0.1:${port}`], { stdio: "inherit" });
  process.exitCode = await new Promise((resolve, reject) => {
    audit.once("error", reject);
    audit.once("exit", code => resolve(code ?? 1));
  });
} finally {
  server.kill();
}
