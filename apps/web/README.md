# Web UI

Optional browser client. Not a trust root. Product name: **AnonGate — Absolute Privacy**.

## Run

From the repository root, after building `packages/sdk-core`:

```bash
npm install --prefix apps/web
npm run dev --prefix apps/web
```

Open [http://127.0.0.1:5180/](http://127.0.0.1:5180/). Use the header switcher:

- **Mainnet** — real ETH, DAI, LUSD
- **Sepolia** — test network; **Mint** tab for tDAI / tLUSD

Proving copies circuit artifacts via `npm run sync:circuits` from `packages/circuits/ceremony/finals/` (included in this repo).

## Product

- **Deposit** — Recovery Code, then on-chain deposit
- **Withdraw** — full, partial + change, or merge two notes
- **Recover** — Recovery Code, `.apnote`, or vault backup
- **Mint** (Sepolia only) — mint experimental tDAI / tLUSD

## Silent send

Requires the local relayer. With both networks running (`npm run start:both` in `packages/relayer`):

| Selected network | Relayer URL |
| --- | --- |
| Mainnet | `http://127.0.0.1:8788` |
| Sepolia | `http://127.0.0.1:8787` |

Overrides: `VITE_RELAYER_URL_MAINNET` / `VITE_RELAYER_URL_SEPOLIA`. See [docs/ENVIRONMENT.md](../../docs/ENVIRONMENT.md).
