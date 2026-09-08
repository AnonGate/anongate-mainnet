import { getActiveNetwork } from "./networkConfig";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Try each configured RPC (and a couple of public fallbacks) until one answers. */
async function publicRpcOnce(
  rpcUrl: string,
  method: string,
  params: unknown[]
): Promise<unknown> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC HTTP ${res.status}`);
  const body = (await res.json()) as {
    result?: unknown;
    error?: { message?: string };
  };
  if (body.error) {
    throw new Error(body.error.message || "RPC error");
  }
  return body.result;
}

function rpcCandidates(): string[] {
  const primary = getActiveNetwork().rpcUrls;
  const extras =
    getActiveNetwork().kind === "mainnet"
      ? [
          "https://cloudflare-eth.com",
          "https://ethereum.publicnode.com",
          "https://1rpc.io/eth",
        ]
      : [
          "https://rpc.sepolia.org",
          "https://ethereum-sepolia.publicnode.com",
        ];
  return [...new Set([...primary, ...extras])];
}

/** JSON-RPC via public RPC — no wallet required (reads / receipts). */
export async function publicRpc(
  method: string,
  params: unknown[] = []
): Promise<unknown> {
  const urls = rpcCandidates();
  let lastErr: unknown;
  for (const rpcUrl of urls) {
    try {
      return await publicRpcOnce(rpcUrl, method, params);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error(String(lastErr ?? "RPC failed"));
}

export async function publicEthCall(params: {
  to: string;
  data: string;
}): Promise<string> {
  return (await publicRpc("eth_call", [
    { to: params.to, data: params.data },
    "latest",
  ])) as string;
}

export async function publicWaitReceipt(
  txHash: string,
  timeoutMs = 180_000
): Promise<{ status: string; transactionHash: string }> {
  const start = Date.now();
  let lastErr: unknown;
  while (Date.now() - start < timeoutMs) {
    for (const rpcUrl of rpcCandidates()) {
      try {
        const receipt = (await publicRpcOnce(rpcUrl, "eth_getTransactionReceipt", [
          txHash,
        ])) as { status: string; transactionHash: string } | null;
        if (receipt) {
          if (receipt.status === "0x0") {
            throw new Error(`transaction reverted: ${txHash}`);
          }
          return receipt;
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/reverted/i.test(msg)) throw e instanceof Error ? e : new Error(msg);
        lastErr = e;
      }
    }
    await sleep(1_000);
  }
  throw new Error(
    `timeout waiting for ${txHash}${
      lastErr instanceof Error ? ` (${lastErr.message})` : ""
    }`
  );
}
