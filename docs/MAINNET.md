# Ethereum mainnet

Chain ID `1`. Live registry: [`deployments/pools.mainnet.json`](../deployments/pools.mainnet.json) (`clientsUnlocked: true`).

Same Phase-2 ceremony finals as Sepolia. Ceremony transcripts: [anongate-ceremony](https://github.com/AnonGate/anongate-ceremony).

## Live pools (canonical assets)

| Role | Value |
| --- | --- |
| ETH pool | Native ETH (`address(0)`), not WETH — see registry |
| DAI pool | Canonical DAI `0x6B175474E89094C44Da98b954EedeAC495271d0F` |
| LUSD pool | Canonical LUSD `0x5f98805A4E8be255a32880FDeC7F6728C6568bA0` |
| Fees | 110 ppm in / 400 ppm out, 100% to the fee recipient |
| Keys | `packages/circuits/ceremony/finals/` |

Exact pool and verifier addresses are only in the registry JSON — verify them against Etherscan before depositing.

## Run the web client on mainnet

```bash
npm install --prefix packages/sdk-core && npm run build --prefix packages/sdk-core
npm install --prefix apps/web
npm run dev --prefix apps/web
```

Open http://127.0.0.1:5180/ and select **Mainnet** in the header. Connect a wallet on chain ID `1`.

There is **no mint** on mainnet. Fund the wallet with real ETH / DAI / LUSD.

## Silent send on mainnet

```bash
cd packages/relayer
# Create packages/relayer/.env.mainnet (see .env.example)
# RELAYER_PRIVATE_KEY=0x…   # NEW hot wallet — not Sepolia, not deployer
# RELAYER_NETWORK=mainnet
# RELAYER_PORT=8788
npm install
npm run start:mainnet
# or both networks: npm run start:both
```

Fund the mainnet relayer with roughly **0.02–0.03 ETH** for gas. Health: http://127.0.0.1:8788/health

The web app posts Silent send to port **8788** when Mainnet is selected.

## CLI / Python

```bash
node packages/cli/bin/ap.mjs mainnet status --asset eth --rpc
```

Python wraps the same CLI; point it at the published mainnet registry the same way.

## Operator addresses (deploy / fees / relayer)

All operator keys for mainnet must be **new**. Do not reuse Sepolia deployer, fee recipient, relayer, Poseidon, verifiers, or pools.

| Role | Where it lives |
| --- | --- |
| Deployer | Used only for contract create — keep offline after deploy |
| Fee recipient | On-chain in the registry (`feeRecipient`) |
| Silent-send relayer | `packages/relayer/.env.mainnet` only (gitignored) |

## Re-deploy / verify (operators only)

Preflight (no broadcast):

```bash
node packages/contracts/scripts/deploy-mainnet-ceremony.mjs
```

Broadcast requires a local `.env.mainnet.local` (gitignored) and the consent flag documented in [`deployments/env.mainnet.example`](../deployments/env.mainnet.example). See that example for RPC and wallet fields.

After any new deploy:

```bash
node packages/contracts/scripts/pin-mainnet-codehashes.mjs
node packages/contracts/scripts/assert-mainnet-pools.mjs
node packages/contracts/scripts/verify-mainnet-explorer.mjs
```

Etherscan settings must match the deploy: `0.8.24+commit.e67f0147`, via-IR, 200 optimizer runs. Poseidon is bytecode-only and will **not** get a green check.

## Honesty

Ceremony transcripts: [anongate-ceremony](https://github.com/AnonGate/anongate-ceremony). Recipient and amount are public on withdraw. Prefer Silent send when you want the gas payer off your payout address.
