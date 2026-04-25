// Returns instantiated ethers.Contract objects for VoterRegistry + Election,
// plus a convenience flag telling whether the connected address is an admin.
// Spec §5.1. Signature stable; body TODO.

import { useEffect, useState } from 'react';
import { Contract } from 'ethers';
import { useWallet } from './useWallet.js';
import addresses from '../contracts/addresses.json';
// ABI JSONs are created by scripts/sync-abi.sh after `forge build`.
// Until then these imports resolve to empty arrays and the contracts are unusable.
// TODO(Dev A): after first forge build, uncomment and verify files exist.
// import voterRegistryAbi from '../contracts/VoterRegistry.json';
// import electionAbi      from '../contracts/Election.json';

/**
 * @returns {{
 *   voterRegistry: import('ethers').Contract | null,
 *   election:      import('ethers').Contract | null,
 *   isAdmin: boolean,
 *   ready: boolean,
 * }}
 */
export function useContract() {
  const { address, chainId, isConnected } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);
  const [contracts, setContracts] = useState({ voterRegistry: null, election: null });

  useEffect(() => {
    // TODO(Dev A):
    //   - if !isConnected: reset contracts to null, isAdmin to false, return.
    //   - resolve chainKey = String(chainId); look up addresses[chainKey].
    //   - get signer via wallet.getSigner().
    //   - new Contract(addresses[chainKey].voterRegistry, voterRegistryAbi.abi, signer);
    //     same for election.
    //   - call voterRegistry.isAdmin(address) → setIsAdmin.
  }, [address, chainId, isConnected]);

  return {
    voterRegistry: contracts.voterRegistry,
    election:      contracts.election,
    isAdmin,
    ready: !!(contracts.voterRegistry && contracts.election),
  };
}
