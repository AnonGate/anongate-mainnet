/**
 * Run Sepolia (8787) + Mainnet (8788) Silent-send relayers together.
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const server = path.join(ROOT, "src", "server.mjs");

for (const name of [".env.sepolia", ".env.mainnet"]) {
  if (!fs.existsSync(path.join(ROOT, name))) {
    console.error(`Missing ${name}. Run node _split_envs.mjs or copy from .env.example.`);
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
  start("sepolia", ".env.sepolia"),
  start("mainnet", ".env.mainnet"),
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
