// app/lib/vault.ts
export const VAULT_ADDRESS = "0xb962EB2C83982D78878d02fF4226718338877b91" as const;

export const vaultABI = [
  {
    "type":"function","stateMutability":"view","name":"claimed",
    "inputs":[{"name":"snapshotId","type":"uint256"},{"name":"user","type":"address"}],
    "outputs":[{"type":"bool"}]
  },
  {
    "type":"function","stateMutability":"nonpayable","name":"claim",
    "inputs":[
      {"name":"snapshotId","type":"uint256"},
      {"name":"amount","type":"uint256"},
      {"name":"proof","type":"bytes32[]"}
    ],
    "outputs":[]
  }
] as const;
