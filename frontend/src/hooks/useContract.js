import { useEffect, useState } from 'react';
import { Contract } from 'ethers';
import { useWallet } from './useWallet.js';
import addresses from '../contracts/addresses.json';
import voterRegistryAbi from '../contracts/VoterRegistry.json';
import electionAbi from '../contracts/Election.json';
import * as wallet from '../lib/wallet.js';

export function useContract() {
  const { address, chainId, isConnected } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);
  const [contracts, setContracts] = useState({ voterRegistry: null, election: null });

  useEffect(() => {
    if (!isConnected) {
      setContracts({ voterRegistry: null, election: null });
      setIsAdmin(false);
      return;
    }

    async function init() {
      const chainKey = String(chainId);
      const addrs = addresses[chainKey];
      if (!addrs) {
        console.warn('useContract: unsupported chainId', chainId);
        setContracts({ voterRegistry: null, election: null });
        setIsAdmin(false);
        return;
      }
      const signer = await wallet.getSigner();
      if (!signer) return;

      const vr = new Contract(addrs.voterRegistry, voterRegistryAbi.abi, signer);
      const el = new Contract(addrs.election, electionAbi.abi, signer);
      setContracts({ voterRegistry: vr, election: el });

      try {
        const admin = await vr.isAdmin(address);
        setIsAdmin(admin);
      } catch {
        setIsAdmin(false);
      }
    }

    init();
  }, [address, chainId, isConnected]);

  return {
    voterRegistry: contracts.voterRegistry,
    election:      contracts.election,
    isAdmin,
    ready: !!(contracts.voterRegistry && contracts.election),
  };
}
