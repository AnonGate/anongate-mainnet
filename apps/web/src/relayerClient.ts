import { getActiveNetwork } from "./networkConfig";

/**
 * Silent-send relayer URL for the active product network.
 * Sepolia → :8787 · Mainnet → :8788 (two processes, two keys).
 * Optional overrides: VITE_RELAYER_URL_SEPOLIA / VITE_RELAYER_URL_MAINNET / VITE_RELAYER_URL
 */
export function relayerBaseUrl(): string {
  const net = getActiveNetwork();
  if (net.kind === "mainnet") {
    const fromEnv = import.meta.env.VITE_RELAYER_URL_MAINNET as string | undefined;
    if (fromEnv?.trim()) return fromEnv.trim();
  } else {
    const fromEnv = import.meta.env.VITE_RELAYER_URL_SEPOLIA as string | undefined;
    if (fromEnv?.trim()) return fromEnv.trim();
  }
  const legacy = import.meta.env.VITE_RELAYER_URL as string | undefined;
  if (legacy?.trim()) return legacy.trim();
  return net.relayerUrl;
}

export type RelayWithdrawResult = {
  ok: true;
  txHash: string;
  relayer: string;
};

export async function relayWithdrawCalldata(params: {
  to: string;
  data: string;
}): Promise<RelayWithdrawResult> {
  const base = relayerBaseUrl();
  const url = `${base.replace(/\/$/, "")}/v1/relay`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chainId: getActiveNetwork().chainId,
      to: params.to,
      data: params.data,
    }),
  });
  const body = (await res.json()) as {
    ok?: boolean;
    txHash?: string;
    relayer?: string;
    error?: string;
  };
  if (!res.ok || !body.ok || !body.txHash) {
    throw new Error(body.error || `relayer HTTP ${res.status}`);
  }
  return {
    ok: true,
    txHash: body.txHash,
    relayer: body.relayer || "",
  };
}

export async function relayerHealth(): Promise<{
  ok: boolean;
  relayer?: string;
  balanceWei?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${relayerBaseUrl().replace(/\/$/, "")}/health`);
    const body = (await res.json()) as {
      ok?: boolean;
      relayer?: string;
      balanceWei?: string;
      error?: string;
    };
    if (!res.ok) return { ok: false, error: body.error || `HTTP ${res.status}` };
    return {
      ok: !!body.ok,
      relayer: body.relayer,
      balanceWei: body.balanceWei,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
