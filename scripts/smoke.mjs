import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PORT = Number(process.env.SMOKE_PORT ?? 3100);
const BASE = `http://127.0.0.1:${PORT}`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForServer(timeoutMs = 25_000) {
  const startedAt = Date.now();
  let lastError = null;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/login`, { redirect: "manual" });
      if (res.status >= 200 && res.status < 500) return;
      lastError = new Error(`Unexpected status: ${res.status}`);
    } catch (e) {
      lastError = e;
    }

    await sleep(350);
  }

  throw new Error(`Server did not become ready at ${BASE}. Last error: ${String(lastError)}`);
}

async function assertGet(path, { allowStatuses = [200], note } = {}) {
  const res = await fetch(`${BASE}${path}`, { redirect: "manual" });
  const ok = allowStatuses.includes(res.status);
  if (!ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `GET ${path} expected ${allowStatuses.join(", ")}, got ${res.status}. ${note ?? ""}\n` +
        body.slice(0, 800)
    );
  }
  return res;
}

async function assertPostJson(path, body, { allowStatuses = [200] } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    redirect: "manual",
  });

  const text = await res.text().catch(() => "");
  const ok = allowStatuses.includes(res.status);
  if (!ok) {
    throw new Error(`POST ${path} expected ${allowStatuses.join(", ")}, got ${res.status}.\n${text.slice(0, 800)}`);
  }

  // Validate response is JSON.
  try {
    JSON.parse(text || "{}");
  } catch {
    throw new Error(`POST ${path} returned non-JSON response.\n${text.slice(0, 800)}`);
  }

  return res;
}

async function main() {
  console.log(`[smoke] Starting Next.js server on ${BASE}`);

  const nextCli = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

  const child = spawn(process.execPath, [nextCli, "start", "-p", String(PORT)], {
    stdio: "inherit",
    cwd: projectRoot,
    env: {
      ...process.env,
      NODE_ENV: "production",
    },
  });

  const stop = async () => {
    if (!child.killed) {
      child.kill("SIGTERM");
      await sleep(300);
      child.kill("SIGKILL");
    }
  };

  try {
    await waitForServer();

    console.log("[smoke] GET core pages");
    await assertGet("/", { allowStatuses: [200, 307, 308] });
    await assertGet("/login", { allowStatuses: [200] });

    // These are auth-gated in practice; without a session, they may still return 200 (client-side redirect)
    // or may be dynamic and render a shell. We just assert they are not hard failing.
    await assertGet("/pipeline", { allowStatuses: [200, 307, 308] });
    await assertGet("/analytics", { allowStatuses: [200, 307, 308] });
    await assertGet("/dashboard", { allowStatuses: [200, 307, 308] });
    await assertGet("/replay", { allowStatuses: [200, 307, 308] });

    console.log("[smoke] API route shape (no OpenAI key required)");
    await assertPostJson(
      "/api/battery-recommendation",
      { batterySolution: "Automotive", brand: "Ford", model: "Ranger", market: "NZ" },
      { allowStatuses: [200] }
    );

    console.log("[smoke] OK");
  } finally {
    await stop();
  }
}

main().catch((e) => {
  console.error("[smoke] FAILED:", e);
  process.exitCode = 1;
});
