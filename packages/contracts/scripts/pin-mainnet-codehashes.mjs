/**
 * After a mainnet verifier deploy, pin runtime codehashes into
 * packages/circuits/ceremony/manifest.expected.json.
 * Does not unlock clients.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMainnetRegistryDeployed, parseDotEnv } from "./lib/mainnet-safety.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractsRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(contractsRoot, "../..");
const registryPath = path.resolve(repoRoot, "deployments/pools.mainnet.json");
const manifestPath = path.resolve(
  repoRoot,
  "packages/circuits/ceremony/manifest.expected.json"
);
const envPath = path.resolve(repoRoot, ".env.mainnet.local");
const cast = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  ".foundry",
  "bin",
  process.platform === "win32" ? "cast.exe" : "cast"
);

const CIRCUITS = {
  deposit: ["depositVerifier", "depositRawVerifier"],
  withdraw: ["withdrawVerifier", "withdrawRawVerifier"],
  withdraw_1in: ["withdraw1Verifier", "withdraw1RawVerifier"],
  withdraw_partial: ["withdrawPartialVerifier", "withdrawPartialRawVerifier"],
};

function rpcUrl() {
  let rpc = process.env.MAINNET_RPC || "";
  if (!rpc && fs.existsSync(envPath)) {
    rpc = parseDotEnv(fs.readFileSync(envPath, "utf8")).MAINNET_RPC || "";
  }
  if (!rpc) throw new Error("MAINNET_RPC required");
  return rpc;
}

function run(args) {
  const res = spawnSync(cast, args, {
    encoding: "utf8",
    cwd: contractsRoot,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (res.status !== 0) {
    throw new Error((res.stderr || res.stdout || "").slice(-2000));
  }
  return (res.stdout || "").trim();
}

function runtimeCodehash(code) {
  const hex = String(code || "").trim();
  if (!hex || hex === "0x") throw new Error("empty runtime code");
  return run(["keccak", hex]);
}

function main() {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  if (!isMainnetRegistryDeployed(registry)) {
    throw new Error("mainnet registry is not deployed yet");
  }
  const rpc = rpcUrl();
  const chainId = Number(run(["chain-id", "--rpc-url", rpc]));
  if (chainId !== 1) throw new Error(`RPC chainId ${chainId} is not mainnet`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const pinned = {};
  for (const [circuit, [adapterField, rawField]] of Object.entries(CIRCUITS)) {
    const adapter = registry.shared[adapterField];
    const raw = registry.shared[rawField];
    const adapterCode = run(["code", adapter, "--rpc-url", rpc]);
    const rawCode = run(["code", raw, "--rpc-url", rpc]);
    const adapterHash = runtimeCodehash(adapterCode);
    const rawHash = runtimeCodehash(rawCode);
    manifest.circuits[circuit].deployedVerifier = {
      adapterRuntimeCodehash: adapterHash,
      rawVerifierRuntimeCodehash: rawHash,
    };
    pinned[circuit] = {
      adapter,
      raw,
      adapterRuntimeCodehash: adapterHash,
      rawVerifierRuntimeCodehash: rawHash,
    };
  }
  manifest.warning =
    "Phase-2 finals after 5 contributions + Ethereum block beacon. Mainnet verifier runtime hashes pinned after deploy.";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    JSON.stringify(
      {
        ok: true,
        clientsUnlocked: registry.clientsUnlocked === true,
        pinned,
        manifestPath,
      },
      null,
      2
    )
  );
}

main();
