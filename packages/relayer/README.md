# Silent-send relayer

Local helper that broadcasts **already-built withdraw calldata** so the user does not submit from their wallet.

Prove in the client first. This service accepts only `{ chainId, to, data }` — never notes or Recovery Codes.

## Networks

| Network | Env file (gitignored) | Template | Port | Health |
| --- | --- | --- | --- | --- |
| **Ethereum mainnet** | `.env.mainnet` | [`.env.mainnet.example`](.env.mainnet.example) | **8788** | http://127.0.0.1:8788/health |
| **Sepolia** | `.env.sepolia` | [`.env.sepolia.example`](.env.sepolia.example) | **8787** | http://127.0.0.1:8787/health |

Use a **different** private key on each network. Never reuse deployer or fee-recipient keys.

## Setup

```bash
cd packages/relayer
npm install

# Mainnet (real ETH for gas)
cp .env.mainnet.example .env.mainnet
# edit RELAYER_PRIVATE_KEY, then:
npm run start:mainnet

# Sepolia (optional / test)
cp .env.sepolia.example .env.sepolia
# edit RELAYER_PRIVATE_KEY, then:
npm run start:sepolia

# Both at once
npm run start:both
```

Index of templates: [`.env.example`](.env.example).

The web app selects the URL from the network switcher (Mainnet → 8788, Sepolia → 8787). Overrides: `VITE_RELAYER_URL_MAINNET` / `VITE_RELAYER_URL_SEPOLIA`.

## Rules

- Never POST notes, spending keys, or Recovery Codes to this service.
- On-chain withdraw fields (recipient, amount, nullifier) stay public — same as a self-broadcast withdraw.
