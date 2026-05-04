export function shortAddr(addr, n = 4, m = 4) {
  if (!addr) return '';
  return addr.slice(0, 2 + n) + '…' + addr.slice(-m);
}
