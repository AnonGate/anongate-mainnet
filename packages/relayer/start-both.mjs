/**
 * Run Mainnet (8788) + Sepolia (8787) Silent-send relayers together.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const server = path.join(ROOT, "src", "server.mjs");

for (const name of [".env.mainnet", ".env.sepolia"]) {
  if (!fs.existsSync(path.join(ROOT, name))) {
    console.error(
      `Missing ${name}. Copy the matching template:\n` +
        `  cp .env.mainnet.example .env.mainnet\n` +
        `  cp .env.sepolia.example  .env.sepolia\n` +
        `Then set a different RELAYER_PRIVATE_KEY in each file.`
    );
    process.exit(1);
  }
}

function start(label, envFile) {
  const child = spawn(
    process.execPath,
    [server, `--env-file=${envFile}`],
    { cwd: ROOT, stdio: "inherit", env: process.env }
  );
  child.on("exit", (code, signal) => {
    console.error(`[${label}] exited code=${code} signal=${signal || ""}`);
    process.exit(code ?? 1);
  });
  return child;
}

const kids = [
  start("mainnet", ".env.mainnet"),
  start("sepolia", ".env.sepolia"),
];

function shutdown() {
  for (const c of kids) {
    try {
      c.kill("SIGTERM");
    } catch {
      /* ignore */
    }
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
