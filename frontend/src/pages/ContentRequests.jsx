/**
 * Content Requests Page
 * Manager view for creating content requests and reviewing model uploads.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Send,
  Image,
  Video,
  Eye,
  CheckCircle,
  XCircle,
  X,
  Upload,
  Copy,
  User,
  FileText,
  Filter,
  ArrowRight,
  Check,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { useModel } from '../context/ModelContext';
import { Layout } from '../components/layout/Layout';
import { api } from '../services/api';

// =============================================
// Helpers
// =============================================

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  const days = Math.floor(diff / 86400000);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

function formatDueDate(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / 86400000);
  if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: 'text-red-400' };
  if (days === 0) return { text: 'Due today', color: 'text-yellow-400' };
  if (days === 1) return { text: 'Due tomorrow', color: 'text-yellow-400' };
  return { text: `Due in ${days}d`, color: 'text-text-muted' };
}

const STATUS_CONFIG = {
  pending:     { label: 'Pending', color: 'bg-gray-500', textColor: 'text-gray-400' },
  in_progress: { label: 'In Progress', color: 'bg-blue-500', textColor: 'text-blue-400' },
  delivered:   { label: 'Delivered', color: 'bg-yellow-500', textColor: 'text-yellow-400' },
  approved:    { label: 'Approved', color: 'bg-green-500', textColor: 'text-green-400' },
  cancelled:   { label: 'Cancelled', color: 'bg-red-500', textColor: 'text-red-400' },
};

const PRIORITY_CONFIG = {
  low:    { label: 'Low', color: 'text-gray-400' },
  normal: { label: 'Normal', color: 'text-text-muted' },
  high:   { label: 'High', color: 'text-orange-400' },
  urgent: { label: 'Urgent', color: 'text-red-400' },
};

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
// Request Card
// =============================================

function RequestCard({ request, onClick, index }) {
  const status = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;
  const priority = PRIORITY_CONFIG[request.priority] || PRIORITY_CONFIG.normal;
  const due = formatDueDate(request.due_date);

  return (
    <button
      onClick={onClick}
      className="stagger-item card-premium card-interactive p-6 text-left"
      style={{ animationDelay: `${Math.min(index * 0.05, 0.3)}s` }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {request.model_avatar ? (
            <img src={request.model_avatar} alt="" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
          ) : (
            <div className="h-8 w-8 rounded-full bg-purple-500/20 flex items-center justify-center flex-shrink-0">
              <User className="h-4 w-4 text-purple-400" />
            </div>
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text truncate">{request.title}</h3>
            <p className="text-xs text-text-muted">{request.model_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${status.color}/20 ${status.textColor}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status.color}`} />
            {status.label}
          </span>
        </div>
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
        {request.upload_count > 0 && (
          <span className="flex items-center gap-1">
            <Upload className="h-3 w-3" /> {request.upload_count} uploaded
          </span>
        )}
        {request.pending_review_count > 0 && (
          <span className="flex items-center gap-1 text-yellow-400">
            <Eye className="h-3 w-3" /> {request.pending_review_count} to review
          </span>
        )}
        {priority.label !== 'Normal' && (
          <span className={`font-medium ${priority.color}`}>{priority.label}</span>
        )}
        {due && <span className={due.color}>{due.text}</span>}
        <span className="ml-auto">{timeAgo(request.created_at)}</span>
      </div>
    </button>
  );
}

// =============================================
// Create Request Modal
// =============================================

function CreateRequestModal({ models, onClose, onCreated }) {
  const [form, setForm] = useState({
    model_id: models.length === 1 ? models[0].id : '',
    title: '',
    description: '',
    quantity_photo: 0,
    quantity_video: 0,
    priority: 'normal',
    due_date: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.model_id || !form.title) {
      console.log('Validation failed: missing model_id or title');
      return;
    }

    console.log('Creating content request with data:', form);
    setSubmitting(true);
    setError('');
    try {
      const result = await api.createContentRequest({
        ...form,
        due_date: form.due_date || null,
      });
      console.log('Content request created successfully:', result);
      onCreated();
      onClose();
    } catch (err) {
      console.error('Failed to create request:', err);
      console.error('Error details:', {
        message: err.message,
        status: err.status,
        data: err.data
      });
      setError(err.message || err.data?.error || 'Failed to create request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in" onClick={onClose}>
      <div className="bg-surface-elevated border border-border rounded-xl w-full max-w-lg mx-4 shadow-glow-lg animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-border bg-gradient-primary/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
              <Plus className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-text">Create Content Request</h2>
              <p className="text-sm text-text-muted">Specify what content you need from creators</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          {/* Error Display */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-400">Error</p>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Model select */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Model</label>
              <select
                value={form.model_id}
                onChange={(e) => setForm({ ...form, model_id: e.target.value })}
                className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-primary focus:shadow-glow focus:outline-none transition-all"
                required
              >
              <option value="">Select a model...</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Title</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="e.g., 5 lingerie photos for PPV"
                className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-primary focus:shadow-glow focus:outline-none transition-all"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-text-muted mb-1">Description (optional)</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Describe what you need — style, setting, outfit, mood..."
                rows={3}
                className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-primary focus:shadow-glow focus:outline-none resize-none transition-all"
              />
            </div>

            {/* Quantities */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Photos needed</label>
                <input
                  type="number"
                  min="0"
                  value={form.quantity_photo}
                  onChange={(e) => setForm({ ...form, quantity_photo: parseInt(e.target.value) || 0 })}
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-primary focus:shadow-glow focus:outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Videos needed</label>
                <input
                  type="number"
                  min="0"
                  value={form.quantity_video}
                  onChange={(e) => setForm({ ...form, quantity_video: parseInt(e.target.value) || 0 })}
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-primary focus:shadow-glow focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Priority + Due date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-primary focus:shadow-glow focus:outline-none transition-all"
                >
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Due date (optional)</label>
                <input
                  type="date"
                  value={form.due_date}
                  onChange={(e) => setForm({ ...form, due_date: e.target.value })}
                  className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text focus:border-primary focus:shadow-glow focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-text-muted hover:text-text hover:bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !form.model_id || !form.title}
                className="btn-gradient flex-1 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-5 w-5" />
                    <span>Create Request</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// =============================================
// Rejection Modal
// =============================================

function RejectionModal({ upload, onReject, onClose }) {
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReject = async () => {
    if (!note.trim()) return;

    setLoading(true);
    try {
      await api.reviewContentUpload(upload.id, {
        action: 'reject',
        rejection_note: note,
      });
      onReject();
    } catch (err) {
      console.error('Rejection failed:', err);
      alert(err.message || 'Failed to reject upload');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl p-6 max-w-md w-full mx-4 shadow-glow-lg animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-text mb-4">Reject Upload</h3>

        <div className="mb-4">
          {upload.file_type === 'video' ? (
            <div className="w-full h-48 bg-surface-elevated rounded-lg flex items-center justify-center">
              <Video className="h-12 w-12 text-text-muted" />
            </div>
          ) : (
            <img src={upload.url} className="w-full h-48 object-cover rounded-lg" alt="" />
          )}
        </div>

        <label className="block text-sm font-medium text-text-muted mb-2">
          Reason for rejection (model will see this)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g., 'Image is too dark' or 'Wrong outfit'"
          rows={4}
          className="w-full bg-surface-elevated border border-border rounded-lg p-3 text-sm focus:border-primary focus:shadow-glow focus:outline-none resize-none mb-4 transition-all"
        />

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg hover:bg-surface transition-colors">
            Cancel
          </button>
          <button
            onClick={handleReject}
            disabled={loading || !note.trim()}
            className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Rejecting...
              </>
            ) : (
              'Reject with Note'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================
// Request Detail (side panel / expanded view)
// =============================================

function RequestDetail({ request, onClose, onRefresh }) {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [portalUrl, setPortalUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [reviewingId, setReviewingId] = useState(null);
  const [selectedUploads, setSelectedUploads] = useState(new Set());
  const [uploadToReject, setUploadToReject] = useState(null);
  const [successToast, setSuccessToast] = useState({ show: false, message: '' });

  useEffect(() => {
    async function load() {
      try {
        const data = await api.getContentRequest(request.id);
        console.log('📋 Request detail data:', data);
        console.log('🔑 Portal token:', data.portal_token);
        setUploads(data.uploads || []);
        if (data.portal_token) {
          const portalUrl = `${window.location.origin}/portal/${data.portal_token}`;
          setPortalUrl(portalUrl);
          console.log('✅ Portal URL generated:', portalUrl);
          console.log('   📱 For mobile: Replace "localhost" with your Mac IP address');
          console.log('   💡 Find IP: ifconfig | grep "inet " | grep -v 127.0.0.1');
        } else {
          console.warn('❌ No portal token found - model may not have a portal_token in database');
          console.warn('   Model ID:', data.model_id);
          console.warn('   Model Name:', data.model_name);
          console.warn('   🔧 Fix: Run SQL backfill to generate portal tokens');
        }
      } catch (err) {
        console.error('Failed to load request detail:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [request.id]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleReview = async (uploadId, action) => {
    setReviewingId(uploadId);
    try {
      await api.reviewContentUpload(uploadId, { action });
      // Refresh uploads
      const data = await api.getContentRequest(request.id);
      setUploads(data.uploads || []);
      onRefresh();
      setSuccessToast({ show: true, message: `Upload ${action === 'approve' ? 'approved' : 'rejected'} successfully` });
    } catch (err) {
      console.error('Review failed:', err);
      alert(err.message || 'Review failed');
    } finally {
      setReviewingId(null);
    }
  };

  const toggleSelection = (uploadId) => {
    setSelectedUploads(prev => {
      const next = new Set(prev);
      if (next.has(uploadId)) {
        next.delete(uploadId);
      } else {
        next.add(uploadId);
      }
      return next;
    });
  };

  const handleBulkApprove = async () => {
    if (selectedUploads.size === 0) return;

    try {
      for (const uploadId of selectedUploads) {
        await api.reviewContentUpload(uploadId, { action: 'approve' });
      }
      // Refresh uploads
      const data = await api.getContentRequest(request.id);
      setUploads(data.uploads || []);
      onRefresh();
      setSelectedUploads(new Set());
      setSuccessToast({ show: true, message: `${selectedUploads.size} upload(s) approved successfully` });
    } catch (err) {
      console.error('Bulk approve failed:', err);
      alert(err.message || 'Bulk approve failed');
    }
  };

  const handleBulkReject = () => {
    if (selectedUploads.size === 0) return;
    // For bulk reject, we need to show rejection modal for first one
    // In a real implementation, you'd want a bulk rejection modal
    const firstUpload = uploads.find(u => selectedUploads.has(u.id));
    if (firstUpload) {
      setUploadToReject(firstUpload);
    }
  };

  const handleRejectionComplete = async () => {
    setUploadToReject(null);
    // Refresh uploads
    const data = await api.getContentRequest(request.id);
    setUploads(data.uploads || []);
    onRefresh();
    setSelectedUploads(new Set());
    setSuccessToast({ show: true, message: 'Upload rejected successfully' });
  };

  const status = STATUS_CONFIG[request.status] || STATUS_CONFIG.pending;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 animate-fade-in" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl bg-surface-elevated border-l border-border overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-border bg-gradient-primary/5 sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text">{request.title}</h2>
                <p className="text-sm text-text-muted">Created {timeAgo(request.created_at)}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-surface rounded-lg transition-colors">
              <X className="h-5 w-5 text-text-muted" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Success Toast */}
          {successToast.show && (
            <div className="mb-4 animate-slide-up">
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 flex-shrink-0" />
                <span className="text-sm text-green-400 font-medium">{successToast.message}</span>
              </div>
            </div>
          )}

          {/* Status Badge */}
          <div className="mb-4">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${status.color}/20 bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/30 shadow-sm`}>
              <span className={`h-2 w-2 rounded-full ${status.color}`} />
              <span className={`text-sm font-semibold ${status.textColor}`}>{status.label}</span>
            </div>
            <span className="text-xs text-text-muted ml-3">for {request.model_name}</span>
          </div>

          {/* Description */}
          {request.description && (
            <div className="mb-4 p-3 bg-surface rounded-lg">
              <p className="text-sm text-text-muted whitespace-pre-wrap">{request.description}</p>
            </div>
          )}

          {/* Quantities & details */}
          <div className="flex items-center gap-4 mb-4 text-sm text-text-muted">
            {request.quantity_photo > 0 && (
              <span className="flex items-center gap-1">
                <Image className="h-4 w-4" /> {request.quantity_photo} photos
              </span>
            )}
            {request.quantity_video > 0 && (
              <span className="flex items-center gap-1">
                <Video className="h-4 w-4" /> {request.quantity_video} videos
              </span>
            )}
            {request.due_date && (() => {
              const due = formatDueDate(request.due_date);
              return <span className={due.color}>{due.text}</span>;
            })()}
          </div>

          {/* Portal link */}
          {portalUrl && (
            <div className="mb-6 p-3 bg-surface rounded-lg border border-border">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-text-muted">Upload link for model</span>
                <button
                  onClick={handleCopyLink}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover"
                >
                  <Copy className="h-3 w-3" />
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              </div>
              <p className="text-xs text-text-muted font-mono truncate">{portalUrl}</p>
            </div>
          )}

          {/* Uploads */}
          <h3 className="text-sm font-semibold text-text mb-3">
            Uploads ({uploads.length})
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : uploads.length === 0 ? (
            <div className="text-center py-8 text-text-muted text-sm">
              No content uploaded yet
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {uploads.map((upload, index) => (
                  <div key={upload.id} className="relative group">
                    {/* Checkbox overlay */}
                    {upload.status === 'pending_review' && (
                      <div
                        className="absolute top-2 left-2 z-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedUploads.has(upload.id)}
                          onChange={() => toggleSelection(upload.id)}
                          className="w-5 h-5 rounded border-2 border-white bg-black/50 cursor-pointer"
                        />
                      </div>
                    )}

                    <div
                      className="stagger-item aspect-square rounded-lg overflow-hidden border-2 border-border bg-surface hover:border-primary/50 hover:shadow-glow hover:-translate-y-1 transition-all duration-200 relative"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      {upload.file_type === 'video' ? (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="h-8 w-8 text-text-muted" />
                        </div>
                      ) : (
                        <img
                          src={upload.thumbnail_url || upload.url}
                          alt={upload.file_name || ''}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )}

                      {/* Gradient Overlay on Hover */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                      {/* Status badge */}
                      <div className="absolute top-2 right-2">
                        {upload.status === 'pending_review' && (
                          <span className="px-2 py-1 bg-yellow-500/90 text-white text-xs font-medium rounded shadow-sm">Review</span>
                        )}
                        {upload.status === 'approved' && (
                          <span className="px-2 py-1 bg-green-500/90 text-white text-xs font-medium rounded shadow-sm">Approved</span>
                        )}
                        {upload.status === 'rejected' && (
                          <span className="px-2 py-1 bg-red-500/90 text-white text-xs font-medium rounded shadow-sm">Rejected</span>
                        )}
                      </div>

                      {/* Review actions */}
                      {upload.status === 'pending_review' && (
                        <div className="absolute bottom-2 inset-x-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleReview(upload.id, 'approve')}
                            disabled={reviewingId === upload.id}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-500 shadow-lg"
                          >
                            <CheckCircle className="h-3.5 w-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => setUploadToReject(upload)}
                            disabled={reviewingId === upload.id}
                            className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-500 shadow-lg"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Reject
                          </button>
                        </div>
                      )}

                      {/* Rejection note display */}
                      {upload.status === 'rejected' && upload.rejection_note && (
                        <div className="absolute bottom-0 left-0 right-0 bg-red-500/95 p-2">
                          <p className="text-white text-[10px] font-medium">Rejected</p>
                          <p className="text-white/90 text-[9px] line-clamp-2">{upload.rejection_note}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Bulk Action Bar */}
              {selectedUploads.size > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 animate-slide-up">
                  <div className="bg-surface border border-border rounded-xl shadow-glow-lg p-4 flex items-center gap-4">
                    <span className="text-sm font-semibold text-text">
                      {selectedUploads.size} selected
                    </span>

                    <button
                      onClick={handleBulkApprove}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                      <CheckCircle className="h-4 w-4" />
                      Approve All
                    </button>

                    <button
                      onClick={handleBulkReject}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2 text-sm font-medium"
                    >
                      <XCircle className="h-4 w-4" />
                      Reject All
                    </button>

                    <button
                      onClick={() => setSelectedUploads(new Set())}
                      className="px-4 py-2 border border-border rounded-lg hover:bg-surface transition-colors text-sm"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Rejection Modal */}
      {uploadToReject && (
        <RejectionModal
          upload={uploadToReject}
          onReject={handleRejectionComplete}
          onClose={() => setUploadToReject(null)}
        />
      )}
    </div>
  );
}

// =============================================
// Main Page
// =============================================

export function ContentRequestsPage() {
  const { selectedModel } = useModel();

  const [requests, setRequests] = useState([]);
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [successToast, setSuccessToast] = useState({ show: false, message: '' });

  // Debug: Log when selectedModel changes
  useEffect(() => {
    console.log('🔍 selectedModel changed:', selectedModel);
  }, [selectedModel]);

  const loadRequests = useCallback(async () => {
    try {
      const params = {};
      // DON'T filter by selectedModel - show ALL requests
      // (selectedModel is for other pages like Dashboard/ImageGen)
      if (filterStatus) params.status = filterStatus;

      console.log('📥 Loading requests with filters:', params);
      console.log('   selectedModel (IGNORED):', selectedModel);
      console.log('   filterStatus:', filterStatus);

      const data = await api.getContentRequests(params);

      console.log('📦 Loaded requests:', data.length, 'requests');
      if (data.length > 0) {
        console.log('   First request:', data[0].title, 'status:', data[0].status);
      }

      setRequests(data);
    } catch (err) {
      console.error('❌ Failed to load content requests:', err);
    }
  }, [filterStatus]); // Removed selectedModel dependency!

  const loadModels = useCallback(async () => {
    try {
      const data = await api.getModels({ status: 'active' });
      setModels(data.models || data || []);
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  }, []);

  useEffect(() => {
    console.log('🔄 useEffect running - loading requests and models');
    Promise.all([loadRequests(), loadModels()]).finally(() => {
      console.log('✅ Initial load complete');
      setLoading(false);
    });
  }, [loadRequests, loadModels]);

  // Debug: Count renders
  useEffect(() => {
    console.log('🎨 ContentRequestsPage rendered');
  });

  const handleCreated = () => {
    setShowCreate(false);
    // Clear filters to ensure new request is visible (new requests default to "pending" status)
    setFilterStatus('');
    // Small delay to ensure filters are cleared before loading
    setTimeout(() => {
      loadRequests();
      setSuccessToast({ show: true, message: 'Content request created successfully' });
    }, 100);
  };

  // Count stats
  const stats = {
    active: requests.filter((r) => ['pending', 'in_progress'].includes(r.status)).length,
    withPendingReviews: requests.filter((r) => r.pending_review_count > 0).length,
    approved: requests.filter((r) => r.status === 'approved').length,
    totalUploads: requests.reduce((sum, r) => sum + (r.upload_count || 0), 0),
  };

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
        {/* Success Toast */}
        <SuccessToast
          show={successToast.show}
          message={successToast.message}
          onClose={() => setSuccessToast({ show: false, message: '' })}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-text mb-2">
              Content <span className="text-transparent bg-clip-text bg-gradient-primary">Requests</span>
            </h1>
            <p className="text-text-muted">
              {stats.active > 0 ? `${stats.active} active • ${stats.withPendingReviews} awaiting review` : 'Manage content requests and review uploads'}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="btn-gradient flex items-center gap-2"
          >
            <Plus className="h-5 w-5" /> New Request
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Active Requests', value: stats.active, icon: FileText, color: 'text-blue-400' },
            { label: 'Pending Review', value: stats.withPendingReviews, icon: Eye, color: 'text-yellow-400' },
            { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-green-400' },
            { label: 'Total Uploads', value: stats.totalUploads, icon: Upload, color: 'text-primary' },
          ].map((stat, index) => (
            <div
              key={stat.label}
              className="stagger-item card-premium p-6"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-text-muted mb-1">{stat.label}</p>
                  <p className="text-3xl font-bold text-text">{stat.value}</p>
                </div>
                <stat.icon className={`h-8 w-8 ${stat.color}`} />
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="card-premium p-4 mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-text">Filters:</span>
          </div>

          {['', 'pending', 'in_progress', 'delivered', 'approved', 'cancelled'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filterStatus === s
                  ? 'bg-primary text-white'
                  : 'bg-surface border border-border text-text-muted hover:text-text hover:bg-surface-elevated'
              }`}
            >
              {s === '' ? 'All' : STATUS_CONFIG[s]?.label || s}
            </button>
          ))}
        </div>

        {/* Request list */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : requests.length === 0 ? (
          <div className="card-premium text-center py-16 animate-fade-in">
            {/* Animated Icon Container */}
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-primary/10 mb-6 animate-float">
              <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
                <FileText className="h-10 w-10 text-white" />
              </div>
            </div>

            {/* Heading with Gradient */}
            <h3 className="text-2xl font-bold text-text mb-3">
              Ready to <span className="text-transparent bg-clip-text bg-gradient-primary">Request Content</span>?
            </h3>

            {/* Description */}
            <p className="text-text-muted max-w-md mx-auto mb-6 leading-relaxed">
              Create content requests to specify exactly what you need from your creators. They'll upload directly to you with no third-party tools needed.
            </p>

            {/* CTA Steps */}
            <div className="flex items-center justify-center gap-8 text-sm text-text-muted mb-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-primary font-bold">1</span>
                </div>
                <span>Create request</span>
              </div>
              <ArrowRight className="h-4 w-4" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-primary font-bold">2</span>
                </div>
                <span>Share portal link</span>
              </div>
              <ArrowRight className="h-4 w-4" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-primary font-bold">3</span>
                </div>
                <span>Review & approve</span>
              </div>
            </div>

            {/* CTA Button */}
            <button onClick={() => setShowCreate(true)} className="btn-gradient inline-flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create Your First Request
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {requests.map((request, index) => (
              <RequestCard
                key={request.id}
                request={request}
                onClick={() => setSelectedRequest(request)}
                index={index}
              />
            ))}
          </div>
        )}

        {/* Create modal */}
        {showCreate && (
          <CreateRequestModal
            models={models}
            onClose={() => setShowCreate(false)}
            onCreated={handleCreated}
          />
        )}

        {/* Detail panel */}
        {selectedRequest && (
          <RequestDetail
            request={selectedRequest}
            onClose={() => setSelectedRequest(null)}
            onRefresh={loadRequests}
          />
        )}
      </div>
    </Layout>
  );
}
