/**
 * Model Portal Page
 * Mobile-friendly upload page for models to view requests and upload content.
 * Authenticated via portal token in URL — no login required.
 */

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Upload,
  Camera,
  Image,
  Video,
  CheckCircle,
  Clock,
  AlertTriangle,
  X,
  ChevronRight,
  Loader2,
  User,
  Plus,
  Eye,
  XCircle,
  Check,
  RefreshCw,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL || '';

// =============================================
// Helpers
// =============================================

function formatDueDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, urgent: true };
  if (days === 0) return { text: 'Due today', urgent: true };
  if (days === 1) return { text: 'Due tomorrow', urgent: false };
  return { text: `Due in ${days} days`, urgent: false };
}

const PRIORITY_COLORS = {
  low: 'border-gray-600',
  normal: 'border-border',
  high: 'border-orange-500/50',
  urgent: 'border-red-500/50',
};

// Fetch helper for portal (no auth token, just plain fetch)
async function portalFetch(endpoint, options = {}) {
  const { headers = {}, ...rest } = options;

  // Include agency slug header for agency resolution
  const agencySlug = localStorage.getItem('portal_agency_slug');

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(agencySlug && { 'X-Agency-Slug': agencySlug }),
      ...headers,
    },
  });

  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// =============================================
// Status Badge Component
// =============================================

function StatusBadge({ status }) {
  const config = {
    pending_review: {
      label: 'Pending Review',
      bgColor: 'bg-yellow-500/20',
      textColor: 'text-yellow-400',
      borderColor: 'border-yellow-500/30',
      icon: Eye,
    },
    approved: {
      label: 'Approved',
      bgColor: 'bg-green-500/20',
      textColor: 'text-green-400',
      borderColor: 'border-green-500/30',
      icon: CheckCircle,
    },
    rejected: {
      label: 'Rejected',
      bgColor: 'bg-red-500/20',
      textColor: 'text-red-400',
      borderColor: 'border-red-500/30',
      icon: XCircle,
    },
  };

  const { label, bgColor, textColor, borderColor, icon: Icon } = config[status];

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${bgColor} ${textColor} border ${borderColor} text-xs font-semibold shadow-sm`}>
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </div>
  );
}

// =============================================
// Success Toast
// =============================================

function SuccessToast({ show, message, onClose }) {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(onClose, 5000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="fixed top-6 right-6 z-50 animate-slide-up">
      <div className="bg-green-500 text-white px-6 py-4 rounded-xl shadow-glow-lg flex items-center gap-3">
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center animate-scale-in">
          <Check className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold">Success!</p>
          <p className="text-sm text-green-100">{message}</p>
        </div>
        <button onClick={onClose} className="ml-4 hover:bg-white/20 p-1 rounded transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// =============================================
// File Selector
// =============================================

function FileUploader({ onUpload, uploading }) {
  const fileInputRef = useRef(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [showMetadata, setShowMetadata] = useState(false);
  const [metadata, setMetadata] = useState({
    caption: '',
    platform: '',
    category: '',
    price: '',
  });

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setSelectedFiles(files);

    // Generate previews
    const newPreviews = files.map((file) => ({
      name: file.name,
      type: file.type.startsWith('video/') ? 'video' : 'image',
      size: file.size,
      url: URL.createObjectURL(file),
    }));
    setPreviews(newPreviews);
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    // Use FormData for efficient multipart upload
    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    // Add metadata if provided
    if (metadata.caption || metadata.platform || metadata.category || metadata.price) {
      formData.append('metadata', JSON.stringify(metadata));
    }

    await onUpload(formData);
    setSelectedFiles([]);
    setPreviews([]);
    setMetadata({ caption: '', platform: '', category: '', price: '' });
    setShowMetadata(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClear = () => {
    setSelectedFiles([]);
    setPreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="card-premium p-8">
      {previews.length === 0 ? (
        <label htmlFor="file-input-portal" className="cursor-pointer block text-center">
          {/* Animated Icon */}
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-primary/10 mb-6 animate-float">
            <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
              <Upload className="h-10 w-10 text-white" />
            </div>
          </div>

          <h3 className="text-xl font-bold text-text mb-2">
            Upload <span className="text-transparent bg-clip-text bg-gradient-primary">Content</span>
          </h3>
          <p className="text-text-muted mb-4">
            Tap to select photos and videos from your device
          </p>

          <button type="button" onClick={() => fileInputRef.current?.click()} className="btn-gradient inline-flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Select Files
          </button>
        </label>
      ) : (
        <div>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {previews.map((p, i) => (
              <div key={i} className="aspect-square rounded-lg overflow-hidden bg-surface border border-border relative">
                {p.type === 'video' ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="h-6 w-6 text-text-muted" />
                  </div>
                ) : (
                  <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                )}
              </div>
            ))}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-border flex items-center justify-center text-text-muted active:bg-surface-elevated"
            >
              <Image className="h-5 w-5" />
            </button>
          </div>

          {/* Metadata Form (Optional) */}
          {showMetadata && (
            <div className="p-4 bg-surface rounded-lg border border-border space-y-3 animate-slide-up">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Caption (optional)</label>
                <textarea
                  value={metadata.caption}
                  onChange={(e) => setMetadata({ ...metadata, caption: e.target.value })}
                  placeholder="Add a caption for this content..."
                  rows={2}
                  className="w-full bg-surface-elevated border border-border rounded-lg p-2 text-sm focus:border-primary focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Platform</label>
                  <select
                    value={metadata.platform}
                    onChange={(e) => setMetadata({ ...metadata, platform: e.target.value })}
                    className="w-full bg-surface-elevated border border-border rounded-lg p-2 text-sm"
                  >
                    <option value="">Select...</option>
                    <option value="onlyfans">OnlyFans</option>
                    <option value="instagram">Instagram</option>
                    <option value="twitter">Twitter</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-muted mb-1">Category</label>
                  <select
                    value={metadata.category}
                    onChange={(e) => setMetadata({ ...metadata, category: e.target.value })}
                    className="w-full bg-surface-elevated border border-border rounded-lg p-2 text-sm"
                  >
                    <option value="">Select...</option>
                    <option value="feed">Feed Post</option>
                    <option value="ppv">PPV</option>
                    <option value="dm_mass">DM Mass</option>
                    <option value="story">Story</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Price (optional)</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-text-muted">$</span>
                  <input
                    type="number"
                    value={metadata.price}
                    onChange={(e) => setMetadata({ ...metadata, price: e.target.value })}
                    placeholder="0.00"
                    className="flex-1 bg-surface-elevated border border-border rounded-lg p-2 text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setShowMetadata(!showMetadata)}
              className="px-4 py-2.5 border border-border rounded-xl text-sm text-text-muted font-medium hover:bg-surface transition-colors"
            >
              {showMetadata ? 'Hide Details' : 'Add Details'}
            </button>
            <button
              onClick={handleClear}
              className="flex-1 py-2.5 border border-border rounded-xl text-sm text-text-muted font-medium hover:bg-surface transition-colors"
            >
              Clear
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="btn-gradient flex-1 flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Uploading {selectedFiles.length} file(s)...</span>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5" />
                  <span>Upload {selectedFiles.length} file(s)</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        id="file-input-portal"
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

// =============================================
// Request Card (model view)
// =============================================

function PortalRequestCard({ request, onSelect, active, index }) {
  const due = formatDueDate(request.due_date);
  const borderColor = PRIORITY_COLORS[request.priority] || PRIORITY_COLORS.normal;

  return (
    <button
      onClick={onSelect}
      className={`stagger-item w-full p-4 rounded-xl border-2 text-left transition-all active:scale-[0.98] card-interactive ${
        active
          ? 'border-primary bg-primary/5'
          : `${borderColor} bg-surface-elevated`
      }`}
      style={{ animationDelay: `${index * 0.05}s` }}
    >
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-semibold text-text">{request.title}</h3>
        <ChevronRight className={`h-4 w-4 ${active ? 'text-primary' : 'text-text-muted'}`} />
      </div>
      {request.description && (
        <p className="text-xs text-text-muted mb-2 line-clamp-2">{request.description}</p>
      )}
      <div className="flex items-center gap-3 text-[11px] text-text-muted">
        {request.quantity_photo > 0 && (
          <span className="flex items-center gap-1">
            <Image className="h-3 w-3" /> {request.quantity_photo} photos
          </span>
        )}
        {request.quantity_video > 0 && (
          <span className="flex items-center gap-1">
            <Video className="h-3 w-3" /> {request.quantity_video} videos
          </span>
        )}
        {due && (
          <span className={due.urgent ? 'text-red-400 font-medium' : ''}>
            {due.text}
          </span>
        )}
        {request.priority === 'urgent' && (
          <span className="text-red-400 font-medium flex items-center gap-0.5">
            <AlertTriangle className="h-3 w-3" /> Urgent
          </span>
        )}
      </div>
    </button>
  );
}

// =============================================
// Main Portal Page
// =============================================

export function ModelPortalPage() {
  const { token } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeRequest, setActiveRequest] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [successToast, setSuccessToast] = useState({ show: false, message: '' });

  const loadPortal = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await portalFetch(`/api/portal/${token}`);
      setData(result);
    } catch (err) {
      console.error('Portal load error:', err);

      // More user-friendly error messages based on status
      if (err.message.includes('403') || err.message.includes('not currently active')) {
        setError('This portal is not currently active. Please contact your agency.');
      } else if (err.message.includes('404') || err.message.includes('Invalid') || err.message.includes('expired')) {
        setError('This upload link is invalid or has expired. Please contact your agency for a new link.');
      } else {
        setError(err.message || 'Unable to load portal. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPortal();
  }, [token]);

  const handleUpload = async (formData) => {
    setUploading(true);
    try {
      // Add request_id to FormData if active request
      if (activeRequest?.id) {
        formData.append('request_id', activeRequest.id);
      }

      // Use multipart endpoint
      const response = await fetch(`${API_BASE}/api/portal/${token}/upload-multipart`, {
        method: 'POST',
        body: formData, // No Content-Type header - browser sets it with boundary
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Upload failed');

      const fileCount = data.uploads?.length || 0;
      setSuccessToast({ show: true, message: `${fileCount} file${fileCount !== 1 ? 's' : ''} uploaded successfully!` });

      // Refresh data
      const result = await portalFetch(`/api/portal/${token}`);
      setData(result);
      setActiveRequest(null);
    } catch (err) {
      console.error('Upload failed:', err);
      alert(err.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-surface border border-border rounded-xl p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-text mb-2">Portal Unavailable</h2>
            <p className="text-text-muted mb-6">{error}</p>
            <button
              onClick={loadPortal}
              className="btn-gradient inline-flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { model, agency, requests, recent_uploads } = data;
  const pendingRequests = requests || [];

  return (
    <div className="min-h-screen bg-background animate-fade-in">
      {/* Success Toast */}
      <SuccessToast
        show={successToast.show}
        message={successToast.message}
        onClose={() => setSuccessToast({ show: false, message: '' })}
      />

      {/* Header */}
      <div className="sticky top-0 z-10 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border px-4 py-8">
        <div className="max-w-lg mx-auto">
          {/* Animated Icon */}
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow animate-float">
              <Upload className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-text">
                <span className="text-transparent bg-clip-text bg-gradient-primary">{model.name}</span> Portal
              </h1>
              <p className="text-text-muted">Upload content for {agency.name}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">

        {/* Content Requests */}
        {pendingRequests.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-text mb-3">
              Requests ({pendingRequests.length})
            </h2>
            <div className="space-y-2">
              {pendingRequests.map((r, index) => (
                <PortalRequestCard
                  key={r.id}
                  request={r}
                  active={activeRequest?.id === r.id}
                  onSelect={() => setActiveRequest(activeRequest?.id === r.id ? null : r)}
                  index={index}
                />
              ))}
            </div>
          </div>
        )}

        {/* Upload area */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-text mb-3">
            {activeRequest ? `Upload for: ${activeRequest.title}` : 'Upload Content'}
          </h2>
          {activeRequest && (
            <div className="mb-3 flex items-center gap-2">
              <button
                onClick={() => setActiveRequest(null)}
                className="text-xs text-primary hover:text-primary-hover flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Clear selection (upload without request)
              </button>
            </div>
          )}
          <FileUploader onUpload={handleUpload} uploading={uploading} />
        </div>

        {/* Recent uploads */}
        {recent_uploads && recent_uploads.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-text mb-3">Recent Uploads</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {recent_uploads.slice(0, 12).map((u, index) => (
                <div
                  key={u.id}
                  className="stagger-item aspect-square rounded-lg overflow-hidden border-2 border-border bg-surface-elevated hover:border-primary/50 hover:shadow-glow hover:-translate-y-1 transition-all duration-200 group relative"
                  style={{ animationDelay: `${index * 0.05}s` }}
                >
                  {u.file_type === 'video' ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <Video className="h-5 w-5 text-text-muted" />
                    </div>
                  ) : (
                    <img
                      src={u.thumbnail_url || u.url}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                      onError={(e) => { e.target.style.display = 'none'; }}
                    />
                  )}

                  {/* Status Badge */}
                  <div className="absolute top-2 left-2">
                    <StatusBadge status={u.status} />
                  </div>

                  {/* Gradient Overlay on Hover */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                  {/* Rejection Note if exists */}
                  {u.status === 'rejected' && u.rejection_note && (
                    <div className="absolute bottom-0 left-0 right-0 bg-red-500/90 p-2">
                      <p className="text-white text-xs font-medium">Rejected</p>
                      <p className="text-white/90 text-xs">{u.rejection_note}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
