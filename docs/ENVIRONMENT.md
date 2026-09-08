# Environment files

This repository does **not** ship private keys. `.env` and `.env.*` are gitignored (except `*.example`).

If a file is missing, copy the example and fill it **locally**.

## What you need by goal

| Goal | Files to create | Required? |
| --- | --- | --- |
| Browse UI / deposit / withdraw via your wallet | None | No |
| Silent send on **Sepolia** | `packages/relayer/.env.sepolia` | Yes (for Silent send only) |
| Silent send on **Mainnet** | `packages/relayer/.env.mainnet` | Yes (for Silent send only) |
| Run **both** Silent send networks together | Both files above + `npm run start:both` | Yes |
| Re-deploy Sepolia contracts | Foundry keystore or local env (never commit) | Operators only |
| Re-deploy Mainnet contracts | Repo-root `.env.mainnet.local` from `deployments/env.mainnet.example` | Operators only |

## Relayer (Silent send)

Published template: [`packages/relayer/.env.example`](../packages/relayer/.env.example).

### Sepolia — `packages/relayer/.env.sepolia`

```bash
RELAYER_PRIVATE_KEY=0xYOUR_SEPOLIA_RELAYER_KEY
RELAYER_NETWORK=sepolia
SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
RELAYER_HOST=127.0.0.1
RELAYER_PORT=8787
```

- Dedicated Sepolia hot wallet with a little **test** ETH.
- Health: http://127.0.0.1:8787/health

### Mainnet — `packages/relayer/.env.mainnet`

```bash
RELAYER_PRIVATE_KEY=0xYOUR_MAINNET_RELAYER_KEY
RELAYER_NETWORK=mainnet
RELAYER_RPC=https://ethereum-rpc.publicnode.com
RELAYER_HOST=127.0.0.1
RELAYER_PORT=8788
```

- **Different** key from Sepolia. Never reuse deployer or fee-recipient keys.
- Fund with roughly **0.02–0.03 ETH** on mainnet for gas.
- Health: http://127.0.0.1:8788/health

### Start

```bash
cd packages/relayer
npm install
npm run start:both          # Sepolia :8787 + Mainnet :8788
# or:
npm run start:sepolia
npm run start:mainnet
```

The web UI picks the URL from the selected network (8787 vs 8788). Overrides: `VITE_RELAYER_URL_SEPOLIA`, `VITE_RELAYER_URL_MAINNET`.

## Web UI

No env file required. Optional:

| Variable | Purpose |
| --- | --- |
| `VITE_RELAYER_URL_SEPOLIA` | Override Sepolia Silent-send base URL |
| `VITE_RELAYER_URL_MAINNET` | Override Mainnet Silent-send base URL |
| `VITE_RELAYER_URL` | Legacy single override (both networks) |

## Mainnet deploy (operators)

```bash
cp deployments/env.mainnet.example .env.mainnet.local
# fill MAINNET_RPC, deployer key, fee recipient, consent flag
```

See [MAINNET.md](MAINNET.md). Never commit `.env.mainnet.local` or `.env.etherscan`.

## Never commit

- `.env`, `.env.sepolia`, `.env.mainnet`, `.env.mainnet.local`, `.env.etherscan`
- `wallets.local.json`, `notes.json`, Recovery Codes, `.apnote`, `.apbackup`
- `packages/cli/.sepolia-live-battery/` and other live-test dumps
- `.mainnet-deploy/` progress files

Safe to publish: `*.example` files and everything under `deployments/*.json` that contains only public addresses.
