# Security

This software is **experimental**. Do not deposit assets you cannot afford to lose.

Live registries:

- Sepolia: [`deployments/pools.sepolia.json`](deployments/pools.sepolia.json)
- Mainnet: [`deployments/pools.mainnet.json`](deployments/pools.mainnet.json) (`clientsUnlocked: true`)

See [docs/MAINNET.md](docs/MAINNET.md) and [docs/SEPOLIA.md](docs/SEPOLIA.md).

## Trust boundaries

- A deployed `ShieldedPool` has no owner, pause, or upgrade path.
- The fee recipient can withdraw only the separately accounted fee balance, not user notes.
- Note secrets, Recovery Codes, and proving stay on the user’s machine in the supplied clients.
- A UI, RPC, or relayer operator can log metadata, refuse requests, or censor access. They cannot spend a note without the user’s secrets and a valid proof.
- Browser storage is unsafe if the tab is compromised. Prefer the CLI for stronger isolation.

## What is public on-chain

Withdraw transactions reveal the recipient, amount, fee, Merkle root, and nullifiers. There is no cryptographic bind from a spend back to a deposit leaf index, but amount, timing, and unique values can still link activity.

## Secrets

Never commit or paste:

- private keys
- `.env` files (including `.env.sepolia`, `.env.mainnet`, `.env.mainnet.local`)
- Recovery Codes / `.apnote` / `.apbackup`
- `notes.json` and proof/call dumps

Templates live in `*.example` files. See [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

Ceremony contribution files and finals are public verification artifacts, not spending secrets. The record is [anongate-ceremony](https://github.com/AnonGate/anongate-ceremony). Contributor random phrases are not published.

## Reporting

If you find a vulnerability in this repository, open a private GitHub security advisory on [AnonGate/anongate-testnet](https://github.com/AnonGate/anongate-testnet) rather than a public issue.
