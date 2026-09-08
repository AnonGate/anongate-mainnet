import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isMainnetRegistryLive } from "../../contracts/scripts/lib/mainnet-safety.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_MAINNET_REGISTRY = path.resolve(
  __dirname,
  "../../../deployments/pools.mainnet.json"
);

export function loadMainnetRegistry(registryPath = DEFAULT_MAINNET_REGISTRY) {
  const resolved = path.resolve(registryPath);
  const registry = JSON.parse(fs.readFileSync(resolved, "utf8"));
  if (registry.chainId !== 1 || registry.network !== "ethereum-mainnet") {
    throw new Error(`not a mainnet deployment registry: ${resolved}`);
  }
  return { registry, registryPath: resolved };
}

export function resolveMainnetAsset(asset, registryPath = DEFAULT_MAINNET_REGISTRY) {
  const id = String(asset ?? "").trim().toLowerCase();
  if (!id) throw new Error("--asset is required (eth, dai, or lusd)");
  const { registry, registryPath: resolved } = loadMainnetRegistry(registryPath);
  if (id === "weth" || id === "tweth") {
    throw new Error(
      "unknown mainnet asset 'weth'; native ETH pool is --asset eth"
    );
  }
  const entry = registry.pools?.[id];
  if (!entry) {
    const keys = Object.keys(registry.pools ?? {}).join(", ");
    throw new Error(`unknown mainnet asset '${asset}'; choose ${keys}`);
  }
  if (!entry.pool) {
    throw new Error(
      "mainnet pools are not deployed yet. See docs/MAINNET.md"
    );
  }
  return {
    id,
    chainId: registry.chainId,
    network: registry.network,
    rpc: registry.rpc,
    status: registry.status,
    warning: registry.warning,
    pool: entry.pool,
    token: entry.asset,
    symbol: entry.assetSymbol,
    decimals: entry.assetDecimals,
    source: entry.assetSource,
    clientsUnlocked: isMainnetRegistryLive(registry),
    registryPath: resolved,
  };
}

export function resolveNetworkCommandArgs(args, { pool = false, token = false } = {}) {
  if (!args.asset) return args;
  const network = String(args.network ?? "sepolia").toLowerCase();
  if (network === "sepolia") {
    return args;
  }
  if (network !== "mainnet") {
    throw new Error("--network must be sepolia or mainnet");
  }
  const resolved = resolveMainnetAsset(args.asset, args.registry);
  if (pool && !args.pool && !args.to && !args.spender) args.pool = resolved.pool;
  if (token && !args.token) args.token = resolved.token;
  if (args.rpc === undefined || args.rpc === true) args.rpc = resolved.rpc;
  args._resolvedMainnet = resolved;
  return args;
}
