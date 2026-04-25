// React hook wrapping lib/wallet.js. Exposes connection state and helpers.
// Spec §5.1. Signature stable; body TODO.

import { useCallback, useEffect, useState } from 'react';
import * as wallet from '../lib/wallet.js';

/**
 * @returns {{
 *   address: string | null,
 *   chainId: number | null,
 *   isConnected: boolean,
 *   connect: () => Promise<void>,
 *   disconnect: () => void,
 * }}
 */
export function useWallet() {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);

  // TODO(Dev A):
  //   - on mount: subscribe via wallet.onAccountOrChainChange(refresh); call refresh() once.
  //   - refresh(): reads wallet.getSigner() + wallet.getChainId(), updates state.
  //   - connect(): call wallet.connect(), then refresh().
  //   - disconnect(): clear state. (Note: MetaMask has no programmatic disconnect.)

  const connect = useCallback(async () => {
    // TODO(Dev A): await wallet.connect(); refresh state.
    throw new Error('TODO: implement useWallet.connect()');
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
  }, []);

  useEffect(() => {
    // TODO(Dev A): subscribe + initial refresh
  }, []);

  return {
    address,
    chainId,
    isConnected: !!address,
    connect,
    disconnect,
  };
}
