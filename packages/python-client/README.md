# Python client

Reference client for automation. Secrets stay local. Poseidon and Groth16 proving call the Node CLI so proofs match the Circom keys. **Node.js is required.**

Pool addresses come from `deployments/pools.sepolia.json` and `deployments/pools.mainnet.json`.

## Setup

```bash
# From repo root (prove/build need the Node CLI)
npm install --prefix packages/sdk-core && npm run build --prefix packages/sdk-core
npm install --prefix packages/cli

cd packages/python-client
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -e .
```

## Sepolia

```bash
python -m absolute_privacy sepolia status --asset eth --rpc
# send / state: --network sepolia --asset eth|dai|lusd
```

## Mainnet

```bash
python -m absolute_privacy mainnet status --asset eth --rpc
# send / state: --network mainnet --asset eth|dai|lusd
```

Uses `deployments/pools.mainnet.json` (`clientsUnlocked: true`). Real funds — prefer a dedicated wallet.

Note, prove, build, and send commands match the JS CLI. Prefer `--passphrase-stdin` or `AP_BACKUP_PASSPHRASE` over a passphrase on the command line.
