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

/**
 * Upload a single image file to Pinata. Validates size + mime before any network call.
 * Returns `ipfs://<CID>` on success. Throws Error with a user-facing Vietnamese message on failure.
 */
export async function uploadToIpfs(file) {
  if (!file) {
    throw new Error('Vui lòng chọn một file.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('File quá lớn (tối đa 5MB).');
  }
  if (!ALLOWED_MIME.includes(file.type)) {
    throw new Error('Chỉ chấp nhận ảnh JPG/PNG/WebP/GIF.');
  }

  const jwt = import.meta.env.VITE_PINATA_JWT;
  if (!jwt) {
    throw new Error('Chưa cấu hình Pinata JWT — xem `.env.example`.');
  }

  const form = new FormData();
  form.append('file', file);

  let res;
  try {
    res = await fetch(PINATA_PIN_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwt}` },
      body: form,
    });
  } catch (_err) {
    throw new Error('Upload thất bại — kiểm tra kết nối mạng.');
  }

  if (res.status === 401) {
    throw new Error('Pinata authentication failed — kiểm tra `VITE_PINATA_JWT`.');
  }
  if (!res.ok) {
    throw new Error(`Upload thất bại (status ${res.status}). Thử lại.`);
  }

  const data = await res.json();
  if (!data.IpfsHash) {
    throw new Error('Pinata không trả về CID. Thử lại.');
  }
  return `ipfs://${data.IpfsHash}`;
}
