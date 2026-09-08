/**
 * Experimental-network guard.
 * Blocks well-known mainnets until a published mainnet registry sets clientsUnlocked.
 * Public testnets like Sepolia are allowed but must show honesty banners.
 */

/** Well-known production EVM chains — refuse experimental *_dev / non-ceremony flows. */
export const KNOWN_MAINNET_CHAIN_IDS: ReadonlySet<number> = new Set([
  1, // Ethereum
  10, // Optimism
  56, // BNB
  100, // Gnosis
  137, // Polygon
  250, // Fantom
  324, // zkSync Era
  1101, // Polygon zkEVM
  8453, // Base
  42161, // Arbitrum One
  42220, // Celo
  43114, // Avalanche C
  59144, // Linea
  534352, // Scroll
]);

/** Public testnets allowed for experimental dry-runs (still not ceremony-grade). */
export const EXPERIMENTAL_PUBLIC_TESTNET_CHAIN_IDS: ReadonlySet<number> = new Set([
  11155111, // Ethereum Sepolia
]);

export function parseChainId(chainId: number | bigint | string): number {
  if (typeof chainId === "number") {
    if (!Number.isInteger(chainId) || chainId < 0) {
      throw new Error("invalid chainId");
    }
    return chainId;
  }
  if (typeof chainId === "bigint") {
    if (chainId < 0n || chainId > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new Error("invalid chainId");
    }
    return Number(chainId);
  }
  const s = String(chainId).trim();
  const n = s.startsWith("0x") || s.startsWith("0X") ? Number.parseInt(s, 16) : Number(s);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`invalid chainId: ${chainId}`);
  }
  return n;
}

export function isKnownMainnetChainId(chainId: number | bigint | string): boolean {
  return KNOWN_MAINNET_CHAIN_IDS.has(parseChainId(chainId));
}

export function isExperimentalPublicTestnet(
  chainId: number | bigint | string
): boolean {
  return EXPERIMENTAL_PUBLIC_TESTNET_CHAIN_IDS.has(parseChainId(chainId));
}

/**
 * User-facing honesty line for the connected / configured chain.
 */
export function getNetworkHonestyBanner(
  chainId: number | bigint | string
): string | null {
  const id = parseChainId(chainId);
  if (isKnownMainnetChainId(id)) {
    return (
      `chainId ${id}: Ethereum mainnet. Shielded pools. Real funds.`
    );
  }
  if (isExperimentalPublicTestnet(id)) {
    return (
      `chainId ${id}: public testnet. Live Sepolia uses Phase-2 ceremony keys. ` +
      `See docs/SEPOLIA.md.`
    );
  }
  if (id === 31337 || id === 1337) {
    return null;
  }
  return (
    `chainId ${id}: treat as experimental unless ceremony verifiers are deployed. ` +
    `See CEREMONY_REQUIREMENTS_V1.md.`
  );
}

/**
 * Throw if chain looks like a funded mainnet and ceremony override is not set.
 * Sepolia and other non-mainnet IDs are allowed (show banner via getNetworkHonestyBanner).
 */
export function assertExperimentalNetworkAllowed(params: {
  chainId: number | bigint | string;
  allowExperimentalNetwork?: boolean;
  mainnetClientsUnlocked?: boolean;
  context?: string;
}): number {
  const id = parseChainId(params.chainId);
  if (!isKnownMainnetChainId(id)) return id;
  if (params.mainnetClientsUnlocked) return id;
  if (params.allowExperimentalNetwork) return id;
  const ctx = params.context ? ` (${params.context})` : "";
  throw new Error(
    `refusing chainId ${id}${ctx}: mainnet clients are locked until a dedicated deploy is recorded ` +
      `and deployments/pools.mainnet.json sets clientsUnlocked true. ` +
      `Use Sepolia (11155111) for testing.`
  );
}
