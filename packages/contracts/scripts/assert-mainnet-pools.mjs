/**
 * Lightweight post-deploy check: chain, assets, fees, no Sepolia reuse.
 * Does not require ceremony codehashes or explorer review.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ASSET_IDS,
  CANONICAL_DAI,
  CANONICAL_LUSD,
  NATIVE_ETH,
  forbiddenSepoliaAddresses,
  isMainnetRegistryDeployed,
  normalizeAddress,
  parseDotEnv,
} from "./lib/mainnet-safety.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractsRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(contractsRoot, "../..");
const registryPath = path.resolve(repoRoot, "deployments/pools.mainnet.json");
const sepoliaPath = path.resolve(repoRoot, "deployments/pools.sepolia.json");
const envPath = path.resolve(repoRoot, ".env.mainnet.local");
const cast = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  ".foundry",
  "bin",
  process.platform === "win32" ? "cast.exe" : "cast"
);

function rpcUrl() {
  let rpc = process.env.MAINNET_RPC || "";
  if (!rpc && fs.existsSync(envPath)) {
    rpc = parseDotEnv(fs.readFileSync(envPath, "utf8")).MAINNET_RPC || "";
  }
  if (!rpc) throw new Error("MAINNET_RPC required");
  return rpc;
}

function run(args) {
  const res = spawnSync(cast, args, { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (res.status !== 0) throw new Error((res.stderr || res.stdout || "").slice(-2000));
  return (res.stdout || "").trim();
}

function call(to, sig, rpc) {
  return run(["call", to, sig, "--rpc-url", rpc]);
}

function main() {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const errors = [];
  if (!isMainnetRegistryDeployed(registry)) {
    errors.push("registry addresses are still null — deploy first");
  }
  const forbidden = forbiddenSepoliaAddresses(
    JSON.parse(fs.readFileSync(sepoliaPath, "utf8"))
  );
  const shared = registry.shared || {};
  const ours = [
    registry.deployer,
    shared.feeRecipient,
    shared.opsFeeRecipient,
    shared.poseidon,
    shared.depositVerifier,
    shared.withdrawVerifier,
    shared.withdraw1Verifier,
    shared.withdrawPartialVerifier,
    ...ASSET_IDS.map((id) => registry.pools?.[id]?.pool),
  ].filter(Boolean);
  for (const addr of ours) {
    if (forbidden.has(normalizeAddress(addr))) {
      errors.push(`Sepolia address reused: ${addr}`);
    }
  }
  if (normalizeAddress(registry.pools?.eth?.asset) !== normalizeAddress(NATIVE_ETH)) {
    errors.push("ETH pool must be native (address zero)");
  }
  if (normalizeAddress(registry.pools?.dai?.asset) !== normalizeAddress(CANONICAL_DAI)) {
    errors.push("DAI asset must be canonical mainnet DAI");
  }
  if (normalizeAddress(registry.pools?.lusd?.asset) !== normalizeAddress(CANONICAL_LUSD)) {
    errors.push("LUSD asset must be canonical mainnet LUSD");
  }
  if (shared.feesPpm?.deposit !== 110 || shared.feesPpm?.withdraw !== 400) {
    errors.push("fees must be 110 / 400 ppm");
  }
  if (registry.clientsUnlocked !== true) {
    errors.push("clientsUnlocked is false — set true only when you intend to open the app");
  }

  const rpc = rpcUrl();
  const chainId = Number(run(["chain-id", "--rpc-url", rpc]));
  if (chainId !== 1) errors.push(`RPC chainId ${chainId} is not mainnet`);

  if (isMainnetRegistryDeployed(registry) && chainId === 1) {
    for (const id of ASSET_IDS) {
      const pool = registry.pools[id].pool;
      const asset = call(pool, "poolAsset()", rpc).slice(-40);
      const expected = normalizeAddress(registry.pools[id].asset).slice(2);
      if (asset.toLowerCase() !== expected) {
        errors.push(`${id} on-chain asset mismatch`);
      }
      const fee = call(pool, "opsFeeRecipient()", rpc).slice(-40);
      if (`0x${fee}`.toLowerCase() !== normalizeAddress(shared.feeRecipient || shared.opsFeeRecipient)) {
        errors.push(`${id} fee recipient mismatch`);
      }
    }
  }

  const report = {
    ok: errors.length === 0,
    clientsUnlocked: registry.clientsUnlocked === true,
    errors,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

main();
