// app/lib/web3Config.js

// Addresses for the deployed contracts on Base Sepolia.
// These values are copied from the upstream repository and should
// correspond to the GameCore contract, its associated RigNFT and the
// $BaseTC ERC‑20 token. If you redeploy contracts, update these
// addresses accordingly.
export const gameCoreAddress = "0xA14b564DBE9A233aedCEbe4F1A4cea812A230187";
export const rigNftAddress = "0xA14b564DBE9A233aedCEbe4F1A4cea812A230187";
export const baseTcAddress = "0x2b8821945abCF33dfB704e08A0AA8C6905fb76D0";

/*
 * Minimal ABI definitions for the contracts used in the BaseTC mini app.
 *
 * To keep this file lightweight and focused on the functionality we need,
 * only the functions that are called from the UI components are included.
 * If you extend the app to use more methods, add them to the respective
 * ABI arrays below. See the full ABI in the upstream repository for a
 * complete list of available methods and events.
 */

// GameCore contract ABI: exposes functions to claim the free Basic rig
// and merge rigs into higher tiers. All functions are nonpayable.
export const gameCoreABI = [
  {
    inputs: [],
    name: "claimFreeBasic",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "mergeToPro",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "mergeToLegend",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
];

// RigNFT contract ABI: only includes the balanceOf function for reading
// how many rigs of a given tier the user owns. The RigNFT contract is
// ERC‑1155 compliant, so balanceOf requires the account and tokenId.
export const rigNftABI = [
  {
    inputs: [
      { internalType: "address", name: "account", type: "address" },
      { internalType: "uint256", name: "id", type: "uint256" },
    ],
    name: "balanceOf",
    outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

// BaseTC token ABI: includes only the approve function, which might be
// necessary if future actions require spending $BaseTC (e.g. repairing
// rigs or paying merge fees). Leaving it here makes future integration
// easier.
export const baseTcABI = [
  {
    inputs: [
      { internalType: "address", name: "spender", type: "address" },
      { internalType: "uint256", name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ internalType: "bool", name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
];