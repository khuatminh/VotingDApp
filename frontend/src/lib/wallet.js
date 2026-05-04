// Low-level MetaMask helpers. No React here — pure functions.
import { BrowserProvider } from 'ethers';

export function hasMetaMask() {
  return typeof window !== 'undefined' && !!window.ethereum;
}

export function getProvider() {
  if (!hasMetaMask()) return null;
  return new BrowserProvider(window.ethereum);
}

export async function connect() {
  const provider = getProvider();
  if (!provider) throw new Error('MetaMask not installed');
  await provider.send('eth_requestAccounts', []);
  const signer = await provider.getSigner();
  return await signer.getAddress();
}

export async function getSigner() {
  const provider = getProvider();
  if (!provider) return null;
  try {
    return await provider.getSigner();
  } catch {
    return null;
  }
}

export async function getChainId() {
  const provider = getProvider();
  if (!provider) return null;
  const net = await provider.getNetwork();
  return Number(net.chainId);
}

export async function switchChain(chainIdHex) {
  if (!hasMetaMask()) throw new Error('MetaMask not installed');
  await window.ethereum.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: chainIdHex }],
  });
}

export function onAccountOrChainChange(handler) {
  if (!hasMetaMask()) return () => {};
  window.ethereum.on('accountsChanged', handler);
  window.ethereum.on('chainChanged', handler);
  return () => {
    window.ethereum.removeListener('accountsChanged', handler);
    window.ethereum.removeListener('chainChanged', handler);
  };
}
