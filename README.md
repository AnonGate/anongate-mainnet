# AnonGate — Absolute Privacy

Non-custodial shielded pools for **ETH**, **DAI**, and **LUSD** on:

| Network | Registry | Status |
| --- | --- | --- |
| **Ethereum mainnet** | [`deployments/pools.mainnet.json`](deployments/pools.mainnet.json) | Live — clients unlocked |
| **Ethereum Sepolia** | [`deployments/pools.sepolia.json`](deployments/pools.sepolia.json) | Live testnet |

The contracts cannot spend your notes. This repository does not host Recovery Codes or private keys.

## What it is

Each asset has its own pool (depth-20 Merkle tree). You deposit, keep a Recovery Code locally, then withdraw to a public address. There is no in-pool transfer path. Silent send is optional: a local relayer broadcasts a withdraw you already proved in the client.

On-chain, recipient and amount are public. The protocol does **not** claim complete unlinkability.

Pools are Etherscan-verified. Poseidon is deployed bytecode and is not explorer-verifiable (expected).

## Repository layout

| Path | Role |
| --- | --- |
| `packages/contracts` | `ShieldedPool`, Groth16 verifiers, Foundry tests |
| `packages/circuits` | Circom circuits and proving-key layout |
| `packages/sdk-core` | Notes, Merkle helpers, backups |
| `packages/cli` | Reference CLI (`ap`) |
| `packages/python-client` | Same flows via the Node CLI |
| `packages/relayer` | Optional local Silent-send relayer (Sepolia **and** Mainnet) |
| `apps/web` | Browser UI (port **5180**) |
| `deployments/` | Published pool registries (no private keys) |

## Can you run this after a clone?

Yes. Proving keys and wasm are in [`packages/circuits/ceremony/finals/`](packages/circuits/ceremony/finals/). Those files are public (anyone who proves needs them). They are not private keys or Recovery Codes.

Phase-2 ceremony transcripts (5 contributors + Ethereum beacon; **same finals for Sepolia and mainnet**): [anongate-ceremony](https://github.com/AnonGate/anongate-ceremony).

No `.env` is required to browse the UI or read pools. Relayer env files are required only for **Silent send**. See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

## Quick start (web)

Node.js 20+ is required.

```bash
npm install --prefix packages/sdk-core && npm run build --prefix packages/sdk-core
npm install --prefix packages/cli
npm install --prefix apps/web
npm run dev --prefix apps/web
```

Open [http://127.0.0.1:5180/](http://127.0.0.1:5180/). Use the network switcher for **Mainnet** or **Sepolia**.

- **Mainnet:** real ETH / DAI / LUSD. No faucet.
- **Sepolia:** test ETH; mint tDAI / tLUSD from the **Mint** tab.

## Silent send (optional, both networks)

Two processes, two keys, two ports — no switching:

```bash
cd packages/relayer
cp .env.mainnet.example .env.mainnet   # then edit — dedicated mainnet key
cp .env.sepolia.example  .env.sepolia   # then edit — different Sepolia key
npm install
npm run start:both
```

| Network | Env file | Port | Health |
| --- | --- | --- | --- |
| Mainnet | `.env.mainnet` | **8788** | http://127.0.0.1:8788/health |
| Sepolia | `.env.sepolia` | **8787** | http://127.0.0.1:8787/health |

Use a **dedicated** hot wallet per network. Never reuse the deployer, fee recipient, or a Sepolia key on mainnet. Fund each with a little ETH for gas only.

Full env reference: [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

## CLI

```bash
npm install --prefix packages/cli

# Sepolia
node packages/cli/bin/ap.mjs sepolia status --asset eth --rpc

# Mainnet (uses deployments/pools.mainnet.json)
node packages/cli/bin/ap.mjs mainnet status --asset eth --rpc
```

See [`packages/cli/README.md`](packages/cli/README.md).

## Python client

```bash
cd packages/python-client
python -m venv .venv
# Windows: .venv\Scripts\activate
# Unix: source .venv/bin/activate
pip install -e .
# Commands wrap the Node CLI — same Sepolia / mainnet registries.
```

See [`packages/python-client/README.md`](packages/python-client/README.md).

## Contract tests (Foundry)

```bash
cd packages/contracts && forge test
```

## Fees (both networks)

- Deposit: **0.011%** (110 ppm)
- Withdraw floor: **0.04%** (400 ppm). Silent send must be strictly above that floor.

100% of protocol fees go to the published fee recipient in the same transaction.

## Documentation

- [How to use Sepolia](docs/SEPOLIA.md)
- [Ethereum mainnet](docs/MAINNET.md)
- [Protocol overview](docs/PROTOCOL.md)
- [Environment files](docs/ENVIRONMENT.md)
- [Contributing](CONTRIBUTING.md)
- [Security](SECURITY.md)
- [Ceremony transcripts](https://github.com/AnonGate/anongate-ceremony)

## Related repositories

| Repo | Contents |
| --- | --- |
| [anongate-testnet](https://github.com/AnonGate/anongate-testnet) | This monorepo (protocol + clients) |
| [anongate-mainnet](https://github.com/AnonGate/anongate-mainnet) | Same monorepo, mainnet-focused landing / mirror |
| [anongate-ceremony](https://github.com/AnonGate/anongate-ceremony) | Phase-2 ceremony transcripts only |

## License

[AGPL-3.0-only](LICENSE).
