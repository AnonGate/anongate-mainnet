# Silent-send relayer

Local helper that broadcasts **already-built withdraw calldata** so the user does not submit from their wallet.

## Dual network (Sepolia + Mainnet at once)

Two processes, two keys, two ports — no switching:

| Network | Env file | Port | Health |
| --- | --- | --- | --- |
| Sepolia | `.env.sepolia` | **8787** | http://127.0.0.1:8787/health |
| Mainnet | `.env.mainnet` | **8788** | http://127.0.0.1:8788/health |

```bash
# fill RELAYER_PRIVATE_KEY in each file (different wallets)
cp .env.example .env.sepolia   # then edit
cp .env.example .env.mainnet   # then edit for mainnet fields

npm install
npm run start:both
```

Or one network only:

```bash
npm run start:sepolia
npm run start:mainnet
```

The web app picks the URL from the selected network automatically.

## Rules

- Prove in the client. Never POST notes, spending keys, or Recovery Codes.
- API accepts only `{ chainId, to, data }`.
- Never reuse the Sepolia key on mainnet. Never reuse deployer / fee recipient keys.

On-chain withdraw fields (recipient, amount, nullifier) stay public — same as a self-broadcast withdraw.

Override URLs in the web app with `VITE_RELAYER_URL_SEPOLIA` / `VITE_RELAYER_URL_MAINNET` if needed.
