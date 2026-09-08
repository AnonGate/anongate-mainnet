# Environment files

This repository does **not** ship private keys. `.env` and `.env.*` are gitignored (except published `*.example` templates).

If a file is missing, copy the matching example and fill it **locally**.

## What you need by goal

| Goal | Files to create | Required? |
| --- | --- | --- |
| Browse UI / deposit / withdraw via your wallet | None | No |
| Silent send on **Mainnet** | `packages/relayer/.env.mainnet` from `.env.mainnet.example` | Yes (Silent send only) |
| Silent send on **Sepolia** | `packages/relayer/.env.sepolia` from `.env.sepolia.example` | Yes (Silent send only) |
| Both Silent send networks together | Both files + `npm run start:both` | Optional |
| Re-deploy Mainnet contracts | Repo-root `.env.mainnet.local` from `deployments/env.mainnet.example` | Operators only |
| Re-deploy Sepolia contracts | Foundry keystore or local env (never commit) | Operators only |

## Relayer (Silent send)

Do **not** copy a single mixed file into both networks. Use the network-specific templates:

### Mainnet — `packages/relayer/.env.mainnet`

```bash
cd packages/relayer
cp .env.mainnet.example .env.mainnet
# set RELAYER_PRIVATE_KEY to a NEW mainnet hot wallet
npm run start:mainnet
```

```bash
RELAYER_PRIVATE_KEY=0xYOUR_MAINNET_RELAYER_KEY
RELAYER_NETWORK=mainnet
RELAYER_RPC=https://ethereum-rpc.publicnode.com
RELAYER_HOST=127.0.0.1
RELAYER_PORT=8788
```

- Fund with roughly **0.02–0.03 ETH** on mainnet for gas.
- Health: http://127.0.0.1:8788/health
- Web UI uses this port when **Mainnet** is selected.

### Sepolia — `packages/relayer/.env.sepolia`

```bash
cd packages/relayer
cp .env.sepolia.example .env.sepolia
# set RELAYER_PRIVATE_KEY to a dedicated Sepolia wallet
npm run start:sepolia
```

```bash
RELAYER_PRIVATE_KEY=0xYOUR_SEPOLIA_RELAYER_KEY
RELAYER_NETWORK=sepolia
SEPOLIA_RPC=https://ethereum-sepolia-rpc.publicnode.com
RELAYER_HOST=127.0.0.1
RELAYER_PORT=8787
```

- Test ETH only. Never reuse this key on mainnet.
- Health: http://127.0.0.1:8787/health

### Run both

```bash
cd packages/relayer
npm install
npm run start:both
```

Templates live next to the server: [`.env.example`](../packages/relayer/.env.example) (index), [`.env.mainnet.example`](../packages/relayer/.env.mainnet.example), [`.env.sepolia.example`](../packages/relayer/.env.sepolia.example).

## Web UI

No env file required. Optional overrides:

| Variable | Purpose |
| --- | --- |
| `VITE_RELAYER_URL_MAINNET` | Override Mainnet Silent-send base URL (default `http://127.0.0.1:8788`) |
| `VITE_RELAYER_URL_SEPOLIA` | Override Sepolia Silent-send base URL (default `http://127.0.0.1:8787`) |
| `VITE_RELAYER_URL` | Legacy single override |

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

Safe to publish: `*.example` templates and public addresses under `deployments/*.json`.
