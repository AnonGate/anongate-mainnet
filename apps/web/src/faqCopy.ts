export type FaqItem = {
  q: string;
  a: string;
};

/** In-app FAQ for Absolute Privacy. No audit claims. */
export const PROTOCOL_FAQ: FaqItem[] = [
  {
    q: "Can someone break the protocol and learn who deposited?",
    a: "No. A withdraw proof shows that a note in the pool is being spent — not which deposit, not who put it in, and not your Recovery Code. There is no admin key that can open notes. Only you (or someone you gave the Recovery Code to) can connect a later withdraw to your deposit.",
  },
  {
    q: "What does the chain see?",
    a: "On deposit it sees the wallet that paid, the asset, and how much went into the pool — plus a commitment (a hash of your note), not the Recovery Code. On withdraw it sees a proof, a public destination, a public amount, and a fee so the payout can land. It does not see which deposit in the pool that payout came from.",
  },
  {
    q: "How should I withdraw for stronger privacy?",
    a: "Use a destination that never deposited. You can exit with Silent send, or with Send via wallet from a different connected wallet — that wallet pays Ethereum gas, and the note still pays the 0.04% protocol fee. Prefer not to broadcast from the same wallet that deposited. If you need funds soon, use Partial + change: take only what you need now, keep the rest in a new note, and withdraw later to another address. You can split one deposit across several exits over time.",
  },
  {
    q: "If I am in a hurry, what should I use?",
    a: "Partial + change. Withdraw the part you need now. The leftover stays in the pool as a new note — save that new Recovery Code before you leave. You can take the rest in later steps, when you want, to a fresh address. You do not have to empty the whole note in one transaction.",
  },
  {
    q: "Do you collect my data?",
    a: "No. This app does not use analytics, cookies, or third-party scripts. Notes stay in this tab until you close it. We never ask for ID. Recovery Codes are not sent to us or to the relayer.",
  },
  {
    q: "Where are my notes stored?",
    a: "In this tab only. Your backup is the Recovery Code (AP1- with a password, or AP1P- if you skipped one). You can also keep an .apnote file. Refreshing or closing the tab clears the session. The deposit stays in the pool; you need the Recovery Code to spend it again.",
  },
  {
    q: "What if I lose the Recovery Code?",
    a: "Nobody can restore it — including us. There is no backdoor. Treat it like a seed phrase and keep it offline. If you set a password, you need the code and the password.",
  },
  {
    q: "What is Silent send?",
    a: "A relayer submits the already-built withdraw so your deposit wallet does not send that transaction. It cannot change the destination or the amount. It never receives your Recovery Code. The note pays the 0.04% protocol fee plus a small gas tip.",
  },
  {
    q: "What is Send via wallet?",
    a: "You broadcast the same proof yourself. Connect a wallet, pay Ethereum gas from that wallet, and the note still pays the 0.04% protocol fee. Use a wallet that did not deposit — so the exit is not signed by the same account that funded the pool. If you do not want to run or trust a relayer, this is the path: you send it, you pay the gas.",
  },
  {
    q: "Silent send or Send via wallet — which should I use?",
    a: "Both spend the same note to the destination you chose. Silent send keeps the deposit wallet off the withdraw transaction. Send via wallet is yours end to end if you prefer not to use a relayer. In either case, send to an address that never deposited.",
  },
  {
    q: "Can the relayer steal my withdraw?",
    a: "No. The destination and amount are locked in the proof. If they were changed, the proof would fail. The relayer can go offline; it cannot send funds somewhere else.",
  },
  {
    q: "Does the destination wallet need ETH?",
    a: "Not to receive the payout. Silent send: the relayer pays Ethereum gas (compensated from the note). Send via wallet: the connected wallet pays that gas. Later, the destination will need a little gas if you want to move the funds onward.",
  },
  {
    q: "Does connecting a wallet give you my notes?",
    a: "No. The wallet only pays gas and (if you choose) broadcasts from your account. Notes and Recovery Codes never leave this tab to the wallet or to us.",
  },
  {
    q: "Can I prove a deposit was mine?",
    a: "Only if you decide to. Nobody else can make that link. You can export a sealed disclosure from a note you hold. That is a choice you make — not a report we generate.",
  },
  {
    q: "Is the code open source?",
    a: "Yes. Contracts, circuits, web, CLI, and Python are in the AnonGate GitHub repositories. Ceremony transcripts are in anongate-ceremony. Pool addresses come from the public registries this app loads.",
  },
  {
    q: "What are Full, Partial, and Merge?",
    a: "Full spends one whole note to a destination. Partial pays some of it out and keeps the rest in a new note (save the new Recovery Code). Merge spends two deposited notes in one withdraw. There is no in-pool transfer on the live pools.",
  },
  {
    q: "What does the protocol charge?",
    a: "0.011% on deposit and 0.04% on withdraw, set in the contracts. Those fees go to the published fee address in the same transaction. Silent send adds a small gas tip from the note to that same address. Send via wallet: you pay Ethereum gas from the connected wallet; the 0.04% still comes from the note.",
  },
  {
    q: "Which assets, and why not USDT or USDC?",
    a: "ETH, DAI, and LUSD — each in its own pool, same asset in and out. A pool is one contract holding every shielded balance of that token. Tokens whose issuer can freeze a contract address would put the whole set at risk. ETH, DAI, and LUSD are chosen so that cannot happen here.",
  },
  {
    q: "Can you freeze or seize funds in the pool?",
    a: "No. A valid proof with an unused nullifier pays out. There is no pause or seize key. If this website is down, the notes are still in the contract — you can withdraw with another client or your own broadcast.",
  },
  {
    q: "Is KYC required?",
    a: "No. Not for deposit, withdraw, recover, Silent send, or Send via wallet. There is no identity check in this protocol.",
  },
  {
    q: "Mainnet or Sepolia?",
    a: "Mainnet is real ETH, DAI, and LUSD. Sepolia is for practice (test ETH and mintable tDAI / tLUSD). Same Recovery Code format. Use different relayer keys on each network.",
  },
  {
    q: "What is the difference vs AnonSwap?",
    a: "This protocol is a shielded pool: you deposit an asset and withdraw the same asset. AnonSwap is the exchange: one coin in, another coin out, across chains. Two products. AnonSwap is at swap.anongate.io.",
  },
];
