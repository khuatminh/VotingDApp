import { describe, it, expect } from 'vitest';
import { ipfsToHttp, PINATA_GATEWAY } from './ipfs.js';

describe('ipfsToHttp', () => {
  it('rewrites ipfs:// URIs to the Pinata gateway', () => {
    expect(ipfsToHttp('ipfs://QmXyz123')).toBe(`${PINATA_GATEWAY}QmXyz123`);
  });

  it('passes https:// URLs through unchanged', () => {
    expect(ipfsToHttp('https://example.com/foo.jpg')).toBe('https://example.com/foo.jpg');
  });

  it('passes http:// URLs through unchanged', () => {
    expect(ipfsToHttp('http://example.com/foo.jpg')).toBe('http://example.com/foo.jpg');
  });

  it('returns empty string for empty/null/undefined input', () => {
    expect(ipfsToHttp('')).toBe('');
    expect(ipfsToHttp(null)).toBe('');
    expect(ipfsToHttp(undefined)).toBe('');
  });
});
