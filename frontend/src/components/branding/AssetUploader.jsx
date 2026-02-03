import { useState } from 'react';
import { Upload, Lock, X, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';

export function AssetUploader({
  type,
  label,
  currentUrl,
  onUpload,
  maxSizeMB = 2,
  locked = false,
  accept = 'image/*'
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(currentUrl);

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File must be smaller than ${maxSizeMB}MB`);
      return;
    }

    setUploading(true);
    setError('');

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target.result);
    reader.readAsDataURL(file);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', type);

      const result = await api.uploadAsset(formData);

      setPreview(result.asset.url);
      onUpload(result.asset.url);
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Upload failed');
      setPreview(currentUrl); // Revert preview on error
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    if (!window.confirm('Remove this asset?')) return;

    try {
      await api.deleteAsset(type);
      setPreview(null);
      onUpload(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove asset');
    }
  };

  if (locked) {
    return (
      <div className="space-y-2 opacity-50">
        <label className="block text-sm font-medium text-text-primary flex items-center gap-2">
          {label}
          <Lock className="h-4 w-4 text-text-muted" />
        </label>
        <div className="border-2 border-dashed border-border rounded-lg p-6 text-center bg-surface">
          <Lock className="h-8 w-8 mx-auto mb-2 text-text-muted" />
          <p className="text-sm text-text-muted">Upgrade to unlock</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-text-primary">
        {label}
      </label>

      {preview && (
        <div className="flex items-center gap-3 p-3 bg-surface border border-border rounded-lg">
          <img
            src={preview}
            alt={label}
            className="h-16 w-16 object-contain border border-border rounded"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              Current {label.toLowerCase()}
            </p>
            {uploading && (
              <p className="text-xs text-text-muted">Uploading...</p>
            )}
          </div>
          {!uploading && (
            <button
              onClick={handleRemove}
              className="p-1 text-error hover:bg-error/10 rounded transition-colors"
              title="Remove"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      <input
        type="file"
        onChange={handleFileSelect}
        disabled={uploading}
        accept={accept}
        className="hidden"
        id={`upload-${type}`}
      />

      <label
        htmlFor={`upload-${type}`}
        className={`
          block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-colors
          ${uploading
            ? 'border-border bg-surface cursor-wait'
            : 'border-border hover:border-primary hover:bg-surface/50'
          }
        `}
      >
        {uploading ? (
          <>
            <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
            <p className="text-sm text-text-muted">Uploading...</p>
          </>
        ) : (
          <>
            <Upload className="h-8 w-8 mx-auto mb-2 text-text-muted" />
            <p className="text-sm font-medium text-text-primary mb-1">
              Click to upload {label.toLowerCase()}
            </p>
            <p className="text-xs text-text-muted">
              Max size: {maxSizeMB}MB
            </p>
          </>
        )}
      </label>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-error/10 border border-error/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-error flex-shrink-0 mt-0.5" />
          <p className="text-sm text-error">{error}</p>
        </div>
      )}
    </div>
  );
}
