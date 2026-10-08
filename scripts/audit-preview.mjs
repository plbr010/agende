import { readdirSync } from "node:fs";
import { join } from "node:path";

// Read-only anonymous smoke checks. Never submit auth, booking or billing forms.
const base = process.argv[2];
const url = base ? new URL(base) : null;
const preview = url?.protocol === "https:" && url.hostname.endsWith(".vercel.app");
const local = url?.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
if (!url || (!preview && !local) || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
  throw new Error("Pass an HTTPS Vercel preview origin or HTTP localhost origin");
}
function pages(dir, route = "") {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) return pages(join(dir, entry.name),
      route + (entry.name.startsWith("(") ? "" : "/" + entry.name));
    return entry.name === "page.tsx" && !route.includes("[") ? [route || "/"] : [];
  });
}
let failed = false;
for (const path of [...pages("src/app"), "/p/e2e-audit-nonexistent-pr12", "/p/e2e-audit-nonexistent-pr12/agendar", "/auth/callback", "/auth/confirm", "/auth/recovery"]) {
  const response = await fetch(new URL(path, base), { redirect: "manual", signal: AbortSignal.timeout(20000) });
  const location = response.headers.get("location");
  const body = await response.text();
  const protectedRoute = path === "/app" || path.startsWith("/app/") || path === "/cliente" || path.startsWith("/cliente/") || path === "/onboarding";
  const pass = protectedRoute ? [303, 307, 308].includes(response.status) && Boolean(location?.includes("/login"))
    : path === "/auth/recovery" || path === "/redefinir-senha" ? [303, 307, 308].includes(response.status) && Boolean(location?.includes("/recuperar-senha?status=expired"))
    : path.startsWith("/auth/") ? [303, 307, 308].includes(response.status) && Boolean(location?.includes("/verificar-email"))
    // Next.js may send a streamed not-found page with a 200 HTTP response.
    : path.startsWith("/p/") ? [200, 404].includes(response.status) && body.includes("Este estabelecimento não está público")
    : response.status === 200;
  if (!pass) failed = true;
  console.log(JSON.stringify({ path, status: response.status, location, result: pass ? "PASS" : "FAIL" }));
}
process.exitCode = failed ? 1 : 0;
