// Chain configuration. Keep in sync with deploy targets.
export const NETWORKS = {
  31337: {
    name: 'Anvil (local)',
    rpcUrl: 'http://127.0.0.1:8545',
    explorerUrl: null,
  },
  11155111: {
    name: 'Sepolia',
    rpcUrl: import.meta.env.VITE_SEPOLIA_RPC || null,
    explorerUrl: 'https://sepolia.etherscan.io',
  },
};

export const DEFAULT_CHAIN_ID = Number(
  import.meta.env.VITE_DEFAULT_CHAIN_ID || 31337
);

export const SUPPORTED_CHAIN_IDS = Object.keys(NETWORKS).map(Number);
