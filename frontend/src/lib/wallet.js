// Low-level MetaMask helpers. No React here — pure functions.
// Spec §5.1. All function bodies are TODOs; signatures are the stable interface.

import { BrowserProvider } from 'ethers';

/** Returns true if window.ethereum is present. */
export function hasMetaMask() {
  // TODO(Dev A): return typeof window !== 'undefined' && !!window.ethereum;
  return false;
}

/** Returns a new ethers BrowserProvider bound to window.ethereum, or null. */
export function getProvider() {
  // TODO(Dev A): if (!hasMetaMask()) return null; return new BrowserProvider(window.ethereum);
  return null;
}

/** Requests account access and returns the checksummed signer address. */
export async function connect() {
  // TODO(Dev A):
  //   - const provider = getProvider();
  //   - if (!provider) throw new Error('MetaMask not installed');
  //   - await provider.send('eth_requestAccounts', []);
  //   - const signer = await provider.getSigner();
  //   - return await signer.getAddress();
  throw new Error('TODO: implement connect()');
}

/** Returns the currently-connected signer, or null if not connected. */
export async function getSigner() {
  // TODO(Dev A): try provider.getSigner() and return; if user not connected, return null.
  return null;
}

/** Returns the current chainId (number), or null. */
export async function getChainId() {
  // TODO(Dev A): const net = await provider.getNetwork(); return Number(net.chainId);
  return null;
}

/** Programmatic chain switch. Falls back to wallet_addEthereumChain on code 4902. */
export async function switchChain(chainIdHex) {
  // TODO(Dev A): window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
  chainIdHex;
  throw new Error('TODO: implement switchChain()');
}

/**
 * Register listeners for accountsChanged + chainChanged.
 * Returns an unsubscribe function.
 */
export function onAccountOrChainChange(handler) {
  // TODO(Dev A):
  //   - window.ethereum.on('accountsChanged', handler);
  //   - window.ethereum.on('chainChanged',     handler);
  //   - return () => { window.ethereum.removeListener(...); };
  handler;
  return () => {};
}
