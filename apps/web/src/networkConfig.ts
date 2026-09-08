/**
 * Product networks for the header switcher.
 * Ethereum mainnet is the default once pools.mainnet.json is unlocked.
 */
export const PRODUCT_NETWORKS = [
  {
    id: "mainnet" as const,
    chainId: 1,
    hexChainId: "0x1",
    name: "Ethereum",
    shortLabel: "Mainnet",
    badge: "Live",
    tone: "mainnet" as const,
    status: "Live",
    live: true,
    detail: "Real ETH, DAI, LUSD",
  },
  {
    id: "sepolia" as const,
    chainId: 11155111,
    hexChainId: "0xaa36a7",
    name: "Ethereum",
    shortLabel: "Sepolia",
    badge: "Test",
    tone: "test" as const,
    status: "Test",
    live: true,
    detail: "Test ETH, no real value",
  },
] as const;

export type ProductNetworkId = (typeof PRODUCT_NETWORKS)[number]["id"];

const PRODUCT_LABELS = {
  eth: { name: "Ethereum", symbol: "ETH" },
  weth: { name: "Ethereum", symbol: "ETH" },
  dai: { name: "Dai", symbol: "DAI" },
  lusd: { name: "Liquity USD", symbol: "LUSD" },
} as Record<string, { name: string; symbol: string }>;

export const SEPOLIA_NETWORK = {
  kind: "sepolia" as const,
  chainId: 11155111,
  displayName: "Ethereum (Sepolia)",
  hexChainId: "0xaa36a7",
  rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
  explorerTx: (hash: string) => `https://sepolia.etherscan.io/tx/${hash}`,
  explorerAddress: (addr: string) => `https://sepolia.etherscan.io/address/${addr}`,
  poolsPath: "/pools.sepolia.json",
  /** Local Silent-send relayer for Sepolia */
  relayerUrl: "http://127.0.0.1:8787",
  productLabels: PRODUCT_LABELS,
};

export const MAINNET_NETWORK = {
  kind: "mainnet" as const,
  chainId: 1,
  displayName: "Ethereum",
  hexChainId: "0x1",
  rpcUrls: ["https://ethereum-rpc.publicnode.com"],
  explorerTx: (hash: string) => `https://etherscan.io/tx/${hash}`,
  explorerAddress: (addr: string) => `https://etherscan.io/address/${addr}`,
  poolsPath: "/pools.mainnet.json",
  /** Local Silent-send relayer for Mainnet (separate process / key) */
  relayerUrl: "http://127.0.0.1:8788",
  productLabels: PRODUCT_LABELS,
};

const STORAGE_KEY = "anongate.productNetwork";

export function networkById(id: ProductNetworkId) {
  return id === "mainnet" ? MAINNET_NETWORK : SEPOLIA_NETWORK;
}

export function isProductNetworkId(value: string): value is ProductNetworkId {
  return value === "mainnet" || value === "sepolia";
}

export function readStoredNetworkId(): ProductNetworkId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && isProductNetworkId(raw)) return raw;
  } catch {
    /* private mode */
  }
  return "mainnet";
}

let activeId: ProductNetworkId = "mainnet";

export function getActiveNetworkId(): ProductNetworkId {
  return activeId;
}

export function getActiveNetwork() {
  return networkById(activeId);
}

export function setActiveNetworkId(id: ProductNetworkId) {
  activeId = id;
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* private mode */
  }
}

/** @deprecated Use getActiveNetwork() — kept for call sites that read at request time. */
export const ACTIVE_NETWORK = MAINNET_NETWORK;

export function isActiveChainId(chainId: number | string): boolean {
  return Number(chainId) === getActiveNetwork().chainId;
}
