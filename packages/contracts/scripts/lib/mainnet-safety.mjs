/**
 * Shared mainnet-prep checks. Never logs private keys.
 */
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const ZERO = /^0x0{40}$/i;
const PK = /^0x[0-9a-fA-F]{64}$/;

export const MAINNET_CHAIN_ID = 1;
export const SEPOLIA_CHAIN_ID = 11155111;
export const NATIVE_ETH = "0x0000000000000000000000000000000000000000";
export const CANONICAL_DAI = "0x6B175474E89094C44Da98b954EedeAC495271d0F";
export const CANONICAL_LUSD = "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0";
export const ASSET_IDS = Object.freeze(["eth", "dai", "lusd"]);

export const RECOMMENDED_DEPLOYER_ETH = "0.12";
export const MINIMUM_DEPLOYER_ETH = "0.05";
export const RECOMMENDED_RELAYER_ETH = "0.03";
/** Refuse broadcast above this unless MAX_GAS_GWEI is raised on purpose. */
export const DEFAULT_MAX_GAS_GWEI = 1;
export const PRIORITY_FEE_WEI = "10000000"; // 0.01 gwei — do not overbid

export function normalizeAddress(value) {
  return String(value || "").trim().toLowerCase();
}

export function isAddress(value) {
  return ADDRESS.test(String(value || ""));
}

export function isNonZeroAddress(value) {
  return isAddress(value) && !ZERO.test(String(value));
}

export function collectAddresses(node, out = new Set()) {
  if (!node) return out;
  if (typeof node === "string" && ADDRESS.test(node) && !ZERO.test(node)) {
    out.add(node.toLowerCase());
    return out;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectAddresses(item, out);
    return out;
  }
  if (typeof node === "object") {
    for (const value of Object.values(node)) collectAddresses(value, out);
  }
  return out;
}

export function forbiddenSepoliaAddresses(sepoliaRegistry) {
  const out = collectAddresses(sepoliaRegistry);
  // Well-known Sepolia operator set (also present in the live registry).
  for (const extra of [
    "0x0435d21d40db54480edcdbd58c2bd72c0d2122d1",
    "0x98f28f2818de6a7120c6b1887611b14935d27e72",
    "0x21271f64c3c0dd6d0ac842e4659b275f80156d64",
    "0xa1cefcd8f0f72684c251c3f352e8d13dd1256d03",
    "0x445a87927c731b741e349d917108e5f6d0b0c24b",
  ]) {
    out.add(extra);
  }
  return out;
}

export function assertNotSepoliaAddress(address, label, forbidden) {
  const n = normalizeAddress(address);
  if (!isNonZeroAddress(n)) {
    throw new Error(`${label} must be a non-zero address`);
  }
  if (forbidden.has(n)) {
    throw new Error(`${label} ${address} was used on Sepolia — use a new mainnet address`);
  }
  return n;
}

export function assertDistinct(addresses, labels) {
  const seen = new Map();
  for (let i = 0; i < addresses.length; i += 1) {
    const n = normalizeAddress(addresses[i]);
    if (!isNonZeroAddress(n)) continue;
    if (seen.has(n)) {
      throw new Error(`${labels[i]} matches ${seen.get(n)} — mainnet roles must be distinct`);
    }
    seen.set(n, labels[i]);
  }
}

export function parseDotEnv(text) {
  const out = {};
  for (const line of String(text).split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i <= 0) continue;
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    out[t.slice(0, i).trim()] = v;
  }
  return out;
}

export function requirePrivateKey(value, label) {
  const v = String(value || "").trim();
  if (!PK.test(v)) {
    throw new Error(`${label} must be a 32-byte hex key starting with 0x`);
  }
  return v;
}

export function isMainnetRegistryLive(registry) {
  if (!registry || registry.chainId !== MAINNET_CHAIN_ID) return false;
  if (registry.clientsUnlocked !== true) return false;
  return ASSET_IDS.every((id) => isNonZeroAddress(registry.pools?.[id]?.pool));
}

export function isMainnetRegistryDeployed(registry) {
  if (!registry || registry.chainId !== MAINNET_CHAIN_ID) return false;
  const shared = registry.shared || {};
  return (
    ASSET_IDS.every((id) => isNonZeroAddress(registry.pools?.[id]?.pool)) &&
    isNonZeroAddress(shared.poseidon) &&
    isNonZeroAddress(shared.depositVerifier) &&
    isNonZeroAddress(shared.withdrawVerifier) &&
    isNonZeroAddress(shared.withdraw1Verifier) &&
    isNonZeroAddress(shared.withdrawPartialVerifier) &&
    isNonZeroAddress(shared.feeRecipient || shared.opsFeeRecipient)
  );
}

export function operatorWalletChecklist() {
  return [
    {
      role: "deployer",
      env: "MAINNET_DEPLOYER_PRIVATE_KEY + MAINNET_DEPLOYER_ADDRESS",
      fund: `${RECOMMENDED_DEPLOYER_ETH} ETH is a comfortable buffer (works at ~0.05 ETH if gas stays low)`,
      notes: "Signs Poseidon, 8 verifiers, 3 pools. New wallet only. Estimated ~8–12M gas total.",
    },
    {
      role: "fee recipient",
      env: "MAINNET_FEE_RECIPIENT",
      fund: "0 ETH required to receive fees",
      notes: "Different from deployer and from every Sepolia address. Receives 100% of protocol fees.",
    },
    {
      role: "relayer",
      env: "packages/relayer/.env RELAYER_PRIVATE_KEY",
      fund: `${RECOMMENDED_RELAYER_ETH} ETH is enough for many Silent sends`,
      notes: "Hot wallet. Different from deployer and fee recipient. Not required for the contract broadcast itself.",
    },
  ];
}
