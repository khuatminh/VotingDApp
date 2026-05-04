import { useCallback, useEffect, useState } from 'react';
import * as wallet from '../lib/wallet.js';

export function useWallet() {
  const [address, setAddress] = useState(null);
  const [chainId, setChainId] = useState(null);

  const refresh = useCallback(async () => {
    const signer = await wallet.getSigner();
    if (!signer) {
      setAddress(null);
      setChainId(null);
      return;
    }
    setAddress(await signer.getAddress());
    setChainId(await wallet.getChainId());
  }, []);

  useEffect(() => {
    const unsub = wallet.onAccountOrChainChange(refresh);
    refresh();
    return unsub;
  }, [refresh]);

  const connect = useCallback(async () => {
    await wallet.connect();
    await refresh();
  }, [refresh]);

  const disconnect = useCallback(() => {
    setAddress(null);
    setChainId(null);
  }, []);

  return {
    address,
    chainId,
    isConnected: !!address,
    connect,
    disconnect,
  };
}
