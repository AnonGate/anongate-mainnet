/**
 * Prepare / deploy Ethereum mainnet ceremony verifiers + ETH/DAI/LUSD pools.
 *
 * Default is preflight only (no broadcast).
 * Broadcast requires --broadcast AND I_UNDERSTAND_MAINNET_UNAUDITED=yes
 * in repo-root .env.mainnet.local.
 *
 * Never prints private keys. Refuses Sepolia addresses.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ASSET_IDS,
  CANONICAL_DAI,
  CANONICAL_LUSD,
  MAINNET_CHAIN_ID,
  DEFAULT_MAX_GAS_GWEI,
  MINIMUM_DEPLOYER_ETH,
  NATIVE_ETH,
  PRIORITY_FEE_WEI,
  RECOMMENDED_DEPLOYER_ETH,
  assertDistinct,
  assertNotSepoliaAddress,
  forbiddenSepoliaAddresses,
  isAddress,
  isNonZeroAddress,
  operatorWalletChecklist,
  parseDotEnv,
  requirePrivateKey,
} from "./lib/mainnet-safety.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractsRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(contractsRoot, "../..");
const registryPath = path.resolve(repoRoot, "deployments/pools.mainnet.json");
const assetsPath = path.resolve(repoRoot, "deployments/assets.mainnet.json");
const webRegistry = path.resolve(repoRoot, "apps/web/public/pools.mainnet.json");
const webAssets = path.resolve(repoRoot, "apps/web/public/assets.mainnet.json");
const sepoliaPath = path.resolve(repoRoot, "deployments/pools.sepolia.json");
const envPath = path.resolve(repoRoot, ".env.mainnet.local");
const progressPath = path.resolve(repoRoot, ".mainnet-deploy/progress.json");
const poseidonFixture = path.resolve(
  contractsRoot,
  "test/fixtures/withdraw_trusted_fixture.json"
);

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

const TREE_DEPTH = "20";
const DEPOSIT_FEE_PPM = "110";
const WITHDRAW_FEE_PPM = "400";
const GAS_REBATE = "0";
const TOKEN_REBATE = "0";
const SOLC = "0.8.24+commit.e67f0147";
const OPTIMIZER_RUNS = "200";

const RPC_FALLBACKS = [
  "https://eth.api.onfinality.io/public",
  "https://eth.blockrazor.xyz",
  "https://1rpc.io/eth",
  "https://rpc.mevblocker.io",
  "https://eth.drpc.org",
  "https://ethereum-rpc.publicnode.com",
  "https://ethereum.publicnode.com",
];

function loadEnvFile() {
  if (!fs.existsSync(envPath)) return {};
  return parseDotEnv(fs.readFileSync(envPath, "utf8"));
}

function env(local, name, fallback = "") {
  return String(process.env[name] || local[name] || fallback).trim();
}

function isTransientRpcError(text) {
  return /error sending request|forcibly closed|timed out|tls close_notify|connection error|failed to fetch block|contract was not deployed/i.test(
    String(text || "")
  );
}

function run(bin, args, opts = {}) {
  const res = spawnSync(bin, args, {
    encoding: "utf8",
    cwd: contractsRoot,
    maxBuffer: 40 * 1024 * 1024,
    env: {
      ...process.env,
      ETH_RPC_TIMEOUT: process.env.ETH_RPC_TIMEOUT || "120",
    },
    ...opts,
  });
  if (res.status !== 0) {
    throw new Error(`${path.basename(bin)} failed:\n${(res.stderr || res.stdout || "").slice(-4000)}`);
  }
  return `${res.stdout || ""}${res.stderr || ""}`;
}

function runQuiet(bin, args) {
  const res = spawnSync(bin, args, {
    encoding: "utf8",
    cwd: contractsRoot,
    maxBuffer: 40 * 1024 * 1024,
    env: {
      ...process.env,
      ETH_RPC_TIMEOUT: process.env.ETH_RPC_TIMEOUT || "120",
    },
  });
  return {
    status: res.status,
    out: `${res.stdout || ""}${res.stderr || ""}`,
  };
}

function rpcList(preferred) {
  const out = [];
  for (const rpc of [preferred, ...RPC_FALLBACKS]) {
    if (rpc && !out.includes(rpc)) out.push(rpc);
  }
  return out;
}

function pickWorkingRpc(preferred) {
  const errors = [];
  for (const rpc of rpcList(preferred)) {
    const res = runQuiet(cast, ["chain-id", "--rpc-url", rpc]);
    if (res.status === 0 && Number(res.out.trim()) === MAINNET_CHAIN_ID) {
      console.log("using RPC", rpc);
      return rpc;
    }
    errors.push(`${rpc}: ${(res.out || "").slice(0, 120).replace(/\s+/g, " ")}`);
  }
  throw new Error(`no working mainnet RPC:\n${errors.join("\n")}`);
}

function deployerNonce(address, rpc) {
  return Number(run(cast, ["nonce", address, "--rpc-url", rpc]).trim());
}

function createAddressAtNonce(deployer, nonce) {
  const out = run(cast, ["compute-address", deployer, "--nonce", String(nonce)]);
  const m = out.match(/0x[a-fA-F0-9]{40}/);
  if (!m) throw new Error(`compute-address failed:\n${out.slice(-400)}`);
  return checksum(m[0]);
}

function parseArgs(argv) {
  const args = { broadcast: false };
  for (const a of argv) {
    if (a === "--broadcast") args.broadcast = true;
    else if (a === "--preflight") args.broadcast = false;
    else throw new Error(`unexpected argument: ${a}`);
  }
  return args;
}

function checksum(address) {
  return run(cast, ["to-check-sum-address", address]).trim();
}

function loadProgress() {
  if (!fs.existsSync(progressPath)) return { steps: {} };
  return JSON.parse(fs.readFileSync(progressPath, "utf8"));
}

function saveProgress(doc) {
  fs.mkdirSync(path.dirname(progressPath), { recursive: true });
  fs.writeFileSync(progressPath, JSON.stringify(doc, null, 2) + "\n");
}

function hasCode(address, rpc) {
  if (!isAddress(address)) return false;
  const code = run(cast, ["code", address, "--rpc-url", rpc]).trim();
  return Boolean(code && code !== "0x");
}

function remember(progress, stepKey, address) {
  progress.steps = progress.steps || {};
  progress.steps[stepKey] = checksum(address);
  progress.updatedAt = new Date().toISOString();
  saveProgress(progress);
  return progress.steps[stepKey];
}

function reuseIfOnChain(progress, stepKey, rpc) {
  const existing = progress.steps?.[stepKey];
  if (existing && hasCode(existing, rpc)) {
    console.log(">>> skip", stepKey, existing, "(already on-chain)");
    return checksum(existing);
  }
  return null;
}

function eip1559FeeFlags() {
  return ["--gas-price", "1gwei", "--priority-gas-price", "0.01gwei"];
}

function deployCreate(contractPath, ctorArgs, pk, rpc, progress, stepKey) {
  const reused = reuseIfOnChain(progress, stepKey, rpc);
  if (reused) return reused;
  const deployer = progress.deployer;
  const rpcs = rpcList(rpc);
  let lastErr = null;
  for (const endpoint of rpcs) {
    let nonceBefore;
    try {
      nonceBefore = deployerNonce(deployer, endpoint);
    } catch (e) {
      lastErr = e;
      continue;
    }
    const predicted = createAddressAtNonce(deployer, nonceBefore);
    if (hasCode(predicted, endpoint)) {
      console.log(">>> recover", stepKey, predicted, "(create address already has code)");
      return remember(progress, stepKey, predicted);
    }
    const args = [
      "create",
      contractPath,
      "--rpc-url",
      endpoint,
      "--private-key",
      pk,
      "--broadcast",
      "--timeout",
      "180",
      "--via-ir",
      "--optimizer-runs",
      OPTIMIZER_RUNS,
      "--use",
      SOLC,
      ...eip1559FeeFlags(),
    ];
    if (ctorArgs.length) args.push("--constructor-args", ...ctorArgs);
    console.log(">>> forge create", contractPath, ctorArgs.join(" "), "via", endpoint);
    const res = runQuiet(forge, args);
    const text = res.out;
    const m = text.match(/Deployed to:\s*(0x[a-fA-F0-9]{40})/);
    if (res.status === 0 && m) {
      console.log("    ->", m[1]);
      return remember(progress, stepKey, m[1]);
    }
    try {
      const nonceAfter = deployerNonce(deployer, endpoint);
      if (nonceAfter > nonceBefore && hasCode(predicted, endpoint)) {
        console.log(">>> recover", stepKey, predicted, "(tx landed after RPC error)");
        return remember(progress, stepKey, predicted);
      }
    } catch {
      /* keep last forge error */
    }
    lastErr = new Error(`forge.exe failed:\n${text.slice(-2000)}`);
    if (!isTransientRpcError(text) && res.status !== 0) break;
    console.log("RPC flake, trying next endpoint…");
  }
  throw lastErr || new Error(`deploy ${stepKey} failed`);
}

function deployPoseidon(pk, rpc, progress) {
  const reused = reuseIfOnChain(progress, "poseidon", rpc);
  if (reused) return reused;
  const fixture = JSON.parse(fs.readFileSync(poseidonFixture, "utf8"));
  const bytecode = fixture.poseidonBytecode;
  if (!/^0x[0-9a-fA-F]+$/.test(bytecode)) {
    throw new Error("poseidon fixture bytecode missing");
  }
  console.log(">>> cast send --create Poseidon bytecode");
  const out = run(cast, [
    "send",
    "--rpc-url",
    rpc,
    "--private-key",
    pk,
    "--priority-gas-price",
    PRIORITY_FEE_WEI,
    "--json",
    "--create",
    bytecode,
  ]);
  let parsed;
  try {
    parsed = JSON.parse(out.slice(out.indexOf("{")));
  } catch {
    throw new Error(`poseidon deploy parse failed:\n${out.slice(-1500)}`);
  }
  const addr = parsed.contractAddress || parsed.to;
  if (!isAddress(addr)) throw new Error("poseidon deploy returned no contractAddress");
  const code = run(cast, ["code", addr, "--rpc-url", rpc]).trim();
  if (!code || code === "0x") throw new Error("poseidon deployed but has no code");
  console.log("    ->", checksum(addr));
  return remember(progress, "poseidon", addr);
}

function writeJson(filePath, doc) {
  fs.writeFileSync(filePath, JSON.stringify(doc, null, 2) + "\n");
}

function preflight({ local, broadcast }) {
  const errors = [];
  const warnings = [];
  let rpc = env(local, "MAINNET_RPC");
  const fee = env(local, "MAINNET_FEE_RECIPIENT");
  const dai = env(local, "DAI_ASSET", CANONICAL_DAI);
  const lusd = env(local, "LUSD_ASSET", CANONICAL_LUSD);
  const consent = env(local, "I_UNDERSTAND_MAINNET_UNAUDITED");
  const pkPresent = Boolean(env(local, "MAINNET_DEPLOYER_PRIVATE_KEY"));
  const sepolia = JSON.parse(fs.readFileSync(sepoliaPath, "utf8"));
  const forbidden = forbiddenSepoliaAddresses(sepolia);
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const assets = JSON.parse(fs.readFileSync(assetsPath, "utf8"));

  if (registry.chainId !== MAINNET_CHAIN_ID) errors.push("pools.mainnet.json chainId must be 1");
  if (assets.chainId !== MAINNET_CHAIN_ID) errors.push("assets.mainnet.json chainId must be 1");
  if (registry.clientsUnlocked === true) {
    errors.push("clientsUnlocked is true before deploy — leave it false until you intentionally open clients");
  }
  if (registry.shared?.feesPpm?.deposit !== 110 || registry.shared?.feesPpm?.withdraw !== 400) {
    errors.push("mainnet fee template must stay 110 / 400 ppm");
  }
  if (assets.assets?.find((a) => a.id === "weth")) {
    errors.push("mainnet assets must use native eth, not weth");
  }

  if (!rpc) errors.push("MAINNET_RPC missing in .env.mainnet.local");
  if (!isNonZeroAddress(fee)) errors.push("MAINNET_FEE_RECIPIENT missing or invalid");
  if (dai.toLowerCase() !== CANONICAL_DAI.toLowerCase()) {
    errors.push("DAI_ASSET must stay the canonical mainnet DAI");
  }
  if (lusd.toLowerCase() !== CANONICAL_LUSD.toLowerCase()) {
    errors.push("LUSD_ASSET must stay the canonical mainnet LUSD");
  }
  if (broadcast && consent !== "yes") {
    errors.push("broadcast requires I_UNDERSTAND_MAINNET_UNAUDITED=yes");
  }
  if (broadcast && !pkPresent) {
    errors.push("broadcast requires MAINNET_DEPLOYER_PRIVATE_KEY");
  }
  if (!fs.existsSync(poseidonFixture)) errors.push("Poseidon fixture missing");
  for (const name of [
    "deposit_CeremonyVerifier.sol",
    "withdraw_CeremonyVerifier.sol",
    "withdraw_1in_CeremonyVerifier.sol",
    "withdraw_partial_CeremonyVerifier.sol",
  ]) {
    const p = path.join(contractsRoot, "src/verifiers/ceremony", name);
    if (!fs.existsSync(p)) errors.push(`missing ${name}`);
  }

  let deployerAddress = env(local, "MAINNET_DEPLOYER_ADDRESS");
  if (pkPresent) {
    try {
      const pk = requirePrivateKey(env(local, "MAINNET_DEPLOYER_PRIVATE_KEY"), "MAINNET_DEPLOYER_PRIVATE_KEY");
      const derived = run(cast, ["wallet", "address", pk]).trim();
      if (deployerAddress && deployerAddress.toLowerCase() !== derived.toLowerCase()) {
        errors.push("MAINNET_DEPLOYER_ADDRESS does not match MAINNET_DEPLOYER_PRIVATE_KEY");
      }
      deployerAddress = derived;
    } catch (e) {
      errors.push(e.message);
    }
  }

  if (isNonZeroAddress(fee)) {
    try {
      assertNotSepoliaAddress(fee, "fee recipient", forbidden);
    } catch (e) {
      errors.push(e.message);
    }
  }
  if (isNonZeroAddress(deployerAddress)) {
    try {
      assertNotSepoliaAddress(deployerAddress, "deployer", forbidden);
    } catch (e) {
      errors.push(e.message);
    }
  }
  try {
    assertDistinct([deployerAddress, fee], ["deployer", "fee recipient"]);
  } catch (e) {
    errors.push(e.message);
  }

  let chainId = null;
  let balanceEth = null;
  let gasGwei = null;
  const maxGasGwei = Number(env(local, "MAX_GAS_GWEI", String(DEFAULT_MAX_GAS_GWEI))) || DEFAULT_MAX_GAS_GWEI;
  if (rpc) {
    try {
      rpc = pickWorkingRpc(rpc);
    } catch (e) {
      errors.push(e.message);
    }
  }
  if (rpc) {
    try {
      chainId = Number(run(cast, ["chain-id", "--rpc-url", rpc]).trim());
      if (chainId !== MAINNET_CHAIN_ID) {
        errors.push(`RPC chainId is ${chainId}, expected 1`);
      }
    } catch (e) {
      errors.push(`RPC check failed: ${e.message}`);
    }
    try {
      const gasWei = BigInt(run(cast, ["gas-price", "--rpc-url", rpc]).trim());
      gasGwei = Number(gasWei) / 1e9;
      if (gasGwei > maxGasGwei) {
        const msg = `gas ${gasGwei.toFixed(4)} gwei is above MAX_GAS_GWEI=${maxGasGwei} — wait for a cheaper block`;
        if (broadcast) errors.push(msg);
        else warnings.push(msg);
      }
    } catch (e) {
      warnings.push(`could not read gas price: ${e.message}`);
    }
    if (isNonZeroAddress(deployerAddress)) {
      try {
        balanceEth = run(cast, ["balance", deployerAddress, "--rpc-url", rpc, "--ether"]).trim();
        if (Number(balanceEth) < Number(MINIMUM_DEPLOYER_ETH)) {
          warnings.push(
            `deployer balance ${balanceEth} ETH is below ${MINIMUM_DEPLOYER_ETH} ETH — fund before broadcast`
          );
        }
      } catch (e) {
        warnings.push(`could not read deployer balance: ${e.message}`);
      }
      try {
        const nonce = Number(run(cast, ["nonce", deployerAddress, "--rpc-url", rpc]).trim());
        if (nonce !== 0) {
          warnings.push(
            `deployer nonce is ${nonce} — first broadcast needs a fresh wallet (nonce 0) unless resuming a partial deploy`
          );
        }
      } catch (e) {
        warnings.push(`could not read deployer nonce: ${e.message}`);
      }
    }
    for (const [label, token] of [
      ["DAI", dai],
      ["LUSD", lusd],
    ]) {
      try {
        const code = run(cast, ["code", token, "--rpc-url", rpc]).trim();
        if (!code || code === "0x") errors.push(`${label} has no code at ${token}`);
      } catch (e) {
        warnings.push(`could not read ${label} code: ${e.message}`);
      }
    }
  } else {
    warnings.push("skipping live RPC checks until MAINNET_RPC is set");
  }

  return {
    ok: errors.length === 0,
    broadcast,
    rpc,
    chainId,
    deployerAddress: deployerAddress || null,
    feeRecipient: isAddress(fee) ? fee : null,
    dai,
    lusd,
    balanceEth,
    gasGwei,
    maxGasGwei,
    recommendedDeployerEth: RECOMMENDED_DEPLOYER_ETH,
    wallets: operatorWalletChecklist(),
    envFile: fs.existsSync(envPath) ? envPath : "(missing — copy deployments/env.mainnet.example)",
    clientsUnlocked: registry.clientsUnlocked === true,
    errors,
    warnings,
  };
}

function applyRegistry({ registry, deployer, fee, poseidon, verifiers, pools }) {
  const next = structuredClone(registry);
  next.version = 1;
  next.status = "deployed-depth20-ceremony-phase2-v1-clients-locked";
  next.clientsUnlocked = false;
  next.warning =
    "Depth-20 pools with Phase-2 ceremony Groth16 keys (same finals as Sepolia). Fees: 0.011% in / 0.04% out, 100% to feeRecipient. Clients stay locked until clientsUnlocked is set true.";
  next.deployer = deployer;
  next.shared = {
    ...next.shared,
    poseidon,
    depositRawVerifier: verifiers.depositRaw,
    depositVerifier: verifiers.depositAdapter,
    withdrawRawVerifier: verifiers.withdrawRaw,
    withdrawVerifier: verifiers.withdrawAdapter,
    withdraw1RawVerifier: verifiers.withdraw1Raw,
    withdraw1Verifier: verifiers.withdraw1Adapter,
    withdrawPartialRawVerifier: verifiers.withdrawPartialRaw,
    withdrawPartialVerifier: verifiers.withdrawPartialAdapter,
    opsFeeRecipient: fee,
    feeRecipient: fee,
    provingKeys: "ceremony-finals",
    ceremonyStatus: "phase2-final-mainnet",
    localTrustedKeys: false,
  };
  next.pools = {
    eth: { ...next.pools.eth, pool: pools.eth, treeDepth: 20 },
    dai: { ...next.pools.dai, pool: pools.dai, treeDepth: 20 },
    lusd: { ...next.pools.lusd, pool: pools.lusd, treeDepth: 20 },
  };
  next.deployment = {
    ...next.deployment,
    ceremonyComplete: true,
    ceremonyAudited: false,
    deployedAt: new Date().toISOString(),
    deployer,
    provingKeys: "ceremony-finals",
    etherscanVerified: false,
    solc: SOLC,
  };
  next.notes =
    "Ceremony Phase-2 mainnet. Deposit 110 ppm / withdraw 400 ppm. Clients remain locked until you set clientsUnlocked true.";
  return next;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const local = loadEnvFile();
  const report = preflight({ local, broadcast: args.broadcast });
  console.log(JSON.stringify({ phase: "preflight", ...report }, null, 2));
  if (!report.ok) {
    process.exitCode = 1;
    return;
  }
  if (!args.broadcast) {
    console.log(
      "\nPreflight only. After wallets are funded, run:\n  node packages/contracts/scripts/deploy-mainnet-ceremony.mjs --broadcast\nClients stay locked after a successful broadcast."
    );
    return;
  }

  const pk = requirePrivateKey(
    env(local, "MAINNET_DEPLOYER_PRIVATE_KEY"),
    "MAINNET_DEPLOYER_PRIVATE_KEY"
  );
  const rpc = report.rpc;
  const fee = checksum(report.feeRecipient);
  const deployer = checksum(report.deployerAddress);
  const forbidden = forbiddenSepoliaAddresses(
    JSON.parse(fs.readFileSync(sepoliaPath, "utf8"))
  );
  assertNotSepoliaAddress(fee, "fee recipient", forbidden);
  assertNotSepoliaAddress(deployer, "deployer", forbidden);

  const progress = loadProgress();
  if (progress.deployer && progress.deployer.toLowerCase() !== deployer.toLowerCase()) {
    throw new Error("resume progress is for a different deployer — stop and tell the operator");
  }
  if (progress.fee && progress.fee.toLowerCase() !== fee.toLowerCase()) {
    throw new Error("resume progress is for a different fee recipient — do not change constructor args mid-deploy");
  }
  const nonce = Number(run(cast, ["nonce", deployer, "--rpc-url", rpc]).trim());
  if (Number.isNaN(nonce)) throw new Error("could not read deployer nonce");
  if (nonce !== 0 && Object.keys(progress.steps || {}).length === 0) {
    throw new Error(
      `deployer nonce is ${nonce} with no resume progress. Do not broadcast from a wallet that already sent a tx.`
    );
  }
  progress.deployer = deployer;
  progress.fee = fee;
  progress.solc = SOLC;
  saveProgress(progress);

  console.log("forge build…");
  run(forge, ["build", "--via-ir", "--use", SOLC]);

  const poseidon = deployPoseidon(pk, rpc, progress);
  assertNotSepoliaAddress(poseidon, "poseidon", forbidden);

  const depositRaw = deployCreate(
    "src/verifiers/ceremony/deposit_CeremonyVerifier.sol:DepositCeremonyVerifier",
    [],
    pk,
    rpc,
    progress,
    "depositRaw"
  );
  const depositAdapter = deployCreate(
    "src/verifiers/CeremonyVerifierAdapters.sol:DepositCeremonyVerifierAdapter",
    [depositRaw],
    pk,
    rpc,
    progress,
    "depositAdapter"
  );
  const withdrawRaw = deployCreate(
    "src/verifiers/ceremony/withdraw_CeremonyVerifier.sol:WithdrawCeremonyVerifier",
    [],
    pk,
    rpc,
    progress,
    "withdrawRaw"
  );
  const withdrawAdapter = deployCreate(
    "src/verifiers/CeremonyVerifierAdapters.sol:WithdrawCeremonyVerifierAdapter",
    [withdrawRaw],
    pk,
    rpc,
    progress,
    "withdrawAdapter"
  );
  const withdraw1Raw = deployCreate(
    "src/verifiers/ceremony/withdraw_1in_CeremonyVerifier.sol:Withdraw_1inCeremonyVerifier",
    [],
    pk,
    rpc,
    progress,
    "withdraw1Raw"
  );
  const withdraw1Adapter = deployCreate(
    "src/verifiers/CeremonyVerifierAdapters.sol:Withdraw1inCeremonyVerifierAdapter",
    [withdraw1Raw],
    pk,
    rpc,
    progress,
    "withdraw1Adapter"
  );
  const withdrawPartialRaw = deployCreate(
    "src/verifiers/ceremony/withdraw_partial_CeremonyVerifier.sol:Withdraw_partialCeremonyVerifier",
    [],
    pk,
    rpc,
    progress,
    "withdrawPartialRaw"
  );
  const withdrawPartialAdapter = deployCreate(
    "src/verifiers/CeremonyVerifierAdapters.sol:WithdrawPartialCeremonyVerifierAdapter",
    [withdrawPartialRaw],
    pk,
    rpc,
    progress,
    "withdrawPartialAdapter"
  );

  const verifiers = {
    depositRaw,
    depositAdapter,
    withdrawRaw,
    withdrawAdapter,
    withdraw1Raw,
    withdraw1Adapter,
    withdrawPartialRaw,
    withdrawPartialAdapter,
  };
  for (const [label, addr] of Object.entries(verifiers)) {
    assertNotSepoliaAddress(addr, label, forbidden);
  }
  assertDistinct(Object.values(verifiers), Object.keys(verifiers));

  function deployPool(asset, stepKey) {
    return deployCreate(
      "src/ShieldedPool.sol:ShieldedPool",
      [
        asset,
        poseidon,
        depositAdapter,
        withdrawAdapter,
        withdraw1Adapter,
        withdrawPartialAdapter,
        TREE_DEPTH,
        DEPOSIT_FEE_PPM,
        WITHDRAW_FEE_PPM,
        fee,
        GAS_REBATE,
        TOKEN_REBATE,
      ],
      pk,
      rpc,
      progress,
      stepKey
    );
  }

  const pools = {
    eth: deployPool(NATIVE_ETH, "poolEth"),
    dai: deployPool(CANONICAL_DAI, "poolDai"),
    lusd: deployPool(CANONICAL_LUSD, "poolLusd"),
  };
  for (const id of ASSET_IDS) {
    assertNotSepoliaAddress(pools[id], `${id} pool`, forbidden);
  }

  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
  const next = applyRegistry({
    registry,
    deployer,
    fee,
    poseidon,
    verifiers,
    pools,
  });
  writeJson(registryPath, next);
  writeJson(webRegistry, next);
  const assets = JSON.parse(fs.readFileSync(assetsPath, "utf8"));
  assets.status = "deployed — clients still locked";
  writeJson(assetsPath, assets);
  writeJson(webAssets, assets);

  const rawOut = path.resolve(contractsRoot, "scripts/mainnet-ceremony-raw.json");
  writeJson(rawOut, next);

  console.log(
    JSON.stringify(
      {
        ok: true,
        phase: "broadcast",
        clientsUnlocked: false,
        deployer,
        feeRecipient: fee,
        poseidon,
        pools,
        next: [
          "node packages/contracts/scripts/pin-mainnet-codehashes.mjs",
          "node packages/contracts/scripts/assert-mainnet-pools.mjs",
          "node packages/contracts/scripts/verify-mainnet-explorer.mjs",
          "keep clientsUnlocked false until you are ready to open the app",
        ],
      },
      null,
      2
    )
  );
}

main();
