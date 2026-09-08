/**
 * Publish mainnet ceremony verifiers, adapters, and pools on Etherscan.
 * Same compiler as the deploy: 0.8.24+commit.e67f0147, via-IR, 200 runs.
 * Poseidon is bytecode-only and is skipped. Does not unlock clients.
 * Needs ETHERSCAN_API_KEY in repo-root .env.etherscan.
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
const envPath = path.resolve(repoRoot, ".env.mainnet.local");
const etherscanPath = path.resolve(repoRoot, ".env.etherscan");
const SOLC = "0.8.24+commit.e67f0147";
const forge = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  ".foundry",
  "bin",
  process.platform === "win32" ? "forge.exe" : "forge"
);
const cast = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  ".foundry",
  "bin",
  process.platform === "win32" ? "cast.exe" : "cast"
);

function loadNamed(filePath, key) {
  if (!fs.existsSync(filePath)) return "";
  return parseDotEnv(fs.readFileSync(filePath, "utf8"))[key] || "";
}

function rpcUrl() {
  return (
    process.env.MAINNET_RPC ||
    loadNamed(envPath, "MAINNET_RPC") ||
    "https://ethereum-rpc.publicnode.com"
  );
}

function run(bin, args) {
  const res = spawnSync(bin, args, {
    encoding: "utf8",
    cwd: contractsRoot,
    maxBuffer: 80 * 1024 * 1024,
    env: process.env,
  });
  return {
    status: res.status,
    out: `${res.stdout || ""}${res.stderr || ""}`,
  };
}

function encode(sig, ...values) {
  const res = run(cast, ["abi-encode", sig, ...values]);
  if (res.status !== 0) throw new Error(`cast abi-encode failed:\n${res.out}`);
  return res.out.trim();
}

function loadEtherscanKey() {
  return (
    String(process.env.ETHERSCAN_API_KEY || "").trim() ||
    loadNamed(etherscanPath, "ETHERSCAN_API_KEY").trim()
  );
}

function poolCtor(registry, asset) {
  const s = registry.shared;
  return encode(
    "constructor(address,address,address,address,address,address,uint32,uint32,uint32,address,uint256,uint256)",
    asset,
    s.poseidon,
    s.depositVerifier,
    s.withdrawVerifier,
    s.withdraw1Verifier,
    s.withdrawPartialVerifier,
    String(s.treeDepth),
    String(s.feesPpm.deposit),
    String(s.feesPpm.withdraw),
    s.feeRecipient,
    String(s.gasRebateWei),
    String(s.tokenRebateAmount)
  );
}

function targetsFrom(registry) {
  const s = registry.shared;
  return [
    {
      name: "depositRawVerifier",
      address: s.depositRawVerifier,
      contract: "src/verifiers/ceremony/deposit_CeremonyVerifier.sol:DepositCeremonyVerifier",
    },
    {
      name: "withdrawRawVerifier",
      address: s.withdrawRawVerifier,
      contract: "src/verifiers/ceremony/withdraw_CeremonyVerifier.sol:WithdrawCeremonyVerifier",
    },
    {
      name: "withdraw1RawVerifier",
      address: s.withdraw1RawVerifier,
      contract:
        "src/verifiers/ceremony/withdraw_1in_CeremonyVerifier.sol:Withdraw_1inCeremonyVerifier",
    },
    {
      name: "withdrawPartialRawVerifier",
      address: s.withdrawPartialRawVerifier,
      contract:
        "src/verifiers/ceremony/withdraw_partial_CeremonyVerifier.sol:Withdraw_partialCeremonyVerifier",
    },
    {
      name: "depositVerifier",
      address: s.depositVerifier,
      contract: "src/verifiers/CeremonyVerifierAdapters.sol:DepositCeremonyVerifierAdapter",
      ctor: encode("constructor(address)", s.depositRawVerifier),
    },
    {
      name: "withdrawVerifier",
      address: s.withdrawVerifier,
      contract: "src/verifiers/CeremonyVerifierAdapters.sol:WithdrawCeremonyVerifierAdapter",
      ctor: encode("constructor(address)", s.withdrawRawVerifier),
    },
    {
      name: "withdraw1Verifier",
      address: s.withdraw1Verifier,
      contract: "src/verifiers/CeremonyVerifierAdapters.sol:Withdraw1inCeremonyVerifierAdapter",
      ctor: encode("constructor(address)", s.withdraw1RawVerifier),
    },
    {
      name: "withdrawPartialVerifier",
      address: s.withdrawPartialVerifier,
      contract: "src/verifiers/CeremonyVerifierAdapters.sol:WithdrawPartialCeremonyVerifierAdapter",
      ctor: encode("constructor(address)", s.withdrawPartialRawVerifier),
    },
    {
      name: "pool_eth",
      address: registry.pools.eth.pool,
      contract: "src/ShieldedPool.sol:ShieldedPool",
      ctor: poolCtor(registry, registry.pools.eth.asset),
    },
    {
      name: "pool_dai",
      address: registry.pools.dai.pool,
      contract: "src/ShieldedPool.sol:ShieldedPool",
      ctor: poolCtor(registry, registry.pools.dai.asset),
    },
    {
      name: "pool_lusd",
      address: registry.pools.lusd.pool,
      contract: "src/ShieldedPool.sol:ShieldedPool",
      ctor: poolCtor(registry, registry.pools.lusd.asset),
    },
  ];
}

function verifyOne(target, apiKey, rpc, extra = []) {
  const args = [
    "verify-contract",
    target.address,
    target.contract,
    "--chain",
    "mainnet",
    "--verifier",
    "etherscan",
    "--watch",
    "--rpc-url",
    rpc,
    "--compiler-version",
    SOLC,
    "--via-ir",
    "--num-of-optimizations",
    "200",
    "--force",
    "--etherscan-api-key",
    apiKey,
    ...extra,
  ];
  if (target.ctor) args.push("--constructor-args", target.ctor);
  const res = run(forge, args);
  const text = res.out.replaceAll(apiKey || "NOKEY", "[redacted]");
  const already = /already verif/i.test(text) || /is already verified/i.test(text);
  const ok =
    res.status === 0 ||
    already ||
    /Successfully verified/i.test(text) ||
    /Pass - Verified/i.test(text) ||
    /Perfect match/i.test(text);
  return {
    name: target.name,
    address: target.address,
    ok,
    already,
    status: res.status,
    tail: text.slice(-900),
  };
}

function main() {
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  if (!isMainnetRegistryDeployed(registry)) {
    throw new Error("mainnet registry is not deployed yet — verify after broadcast");
  }
  const apiKey = loadEtherscanKey();
  if (!apiKey) {
    throw new Error("ETHERSCAN_API_KEY missing — put it in .env.etherscan");
  }
  const rpc = rpcUrl();
  const chain = run(cast, ["chain-id", "--rpc-url", rpc]);
  if (chain.status !== 0 || Number(chain.out.trim()) !== 1) {
    throw new Error(`RPC chainId is not mainnet: ${chain.out.slice(-400)}`);
  }

  console.log("forge build…");
  const built = run(forge, ["build", "--via-ir", "--use", SOLC]);
  if (built.status !== 0) throw new Error(`forge build failed:\n${built.out.slice(-2000)}`);

  const results = [];
  for (const target of targetsFrom(registry)) {
    console.log(`\n>>> etherscan ${target.name} ${target.address}`);
    let row = verifyOne(target, apiKey, rpc);
    results.push(row);
    console.log(row.ok ? "OK" : "FAIL", row.already ? "(already)" : "");
    if (!row.ok) console.log(row.tail);
  }

  const reportPath = path.join(contractsRoot, "scripts", "mainnet-explorer-verify-report.json");
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        finishedAt: new Date().toISOString(),
        solc: SOLC,
        skipped: {
          poseidon: registry.shared.poseidon,
          reason: "Deployed from raw circomlib bytecode — no Solidity source",
          eoa: [registry.deployer, registry.shared.feeRecipient],
        },
        results: results.map(({ tail, ...rest }) => rest),
      },
      null,
      2
    ) + "\n"
  );

  const failed = results.filter((r) => !r.ok);
  console.log(`\nDONE ${results.length - failed.length}/${results.length} → ${reportPath}`);
  console.log("Poseidon will stay unverified on the explorer (bytecode-only). That is expected.");
  if (failed.length) {
    console.log("Verification failed for some contracts. Do NOT redeploy — retry this script.");
    process.exitCode = 1;
  }
}

main();
