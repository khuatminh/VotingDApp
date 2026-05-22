import { useRef, useState } from 'react';
import { ipfsToHttp, uploadToIpfs } from '../lib/ipfs.js';

/**
 * Controlled image uploader. Persists nothing of its own — emits the
 * final `ipfs://<CID>` (or `''`) to the parent through onChange.
 *
 * Props:
 *   value:    string  — current url (ipfs://, https://, or '')
 *   onChange: (newUrl: string) => void
 *   label?:   string  — optional field label
 */
export default function ImageUploader({ value, onChange, label }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  async function handleFile(ev) {
    const file = ev.target.files?.[0];
    ev.target.value = '';                              // allow re-picking the same file later
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const url = await uploadToIpfs(file);
      onChange(url);
    } catch (err) {
      setError(err.message || 'Upload thất bại.');
    } finally {
      setUploading(false);
    }
  }

  function handleClear() {
    setError('');
    onChange('');
  }

  const previewSrc = ipfsToHttp(value);

  return (
    <div className="image-uploader">
      {label && <label>{label}</label>}

      {previewSrc && (
        <div style={{ marginBottom: 8 }}>
          <img
            src={previewSrc}
            alt=""
            style={{ maxWidth: 160, maxHeight: 160, borderRadius: 8, display: 'block' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          disabled={uploading}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className="btn btn-sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
        >
          {uploading ? 'Đang upload…' : (value ? 'Đổi ảnh' : 'Chọn file')}
        </button>
        {value && !uploading && (
          <button type="button" className="btn btn-sm" onClick={handleClear}>
            Xoá ảnh
          </button>
        )}
      </div>

      {error && (
        <div style={{ color: '#f87171', fontSize: '0.85rem', marginTop: 6 }}>
          {error}
        </div>
      )}
    </div>
  );
}
