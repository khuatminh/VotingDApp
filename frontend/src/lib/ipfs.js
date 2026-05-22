// Pinata-based IPFS upload + gateway helpers.
// See docs/superpowers/specs/2026-05-22-ipfs-image-storage-design.md

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs/';
const PINATA_PIN_ENDPOINT = 'https://api.pinata.cloud/pinning/pinFileToIPFS';

/**
 * Rewrite an `ipfs://<CID>` URI to a public Pinata gateway URL.
 * Non-IPFS inputs (http/https/empty/null) are returned unchanged (or as '').
 */
export function ipfsToHttp(url) {
  if (!url) return '';
  if (typeof url !== 'string') return '';
  if (url.startsWith('ipfs://')) {
    return PINATA_GATEWAY + url.slice('ipfs://'.length);
  }
  return url;
}
