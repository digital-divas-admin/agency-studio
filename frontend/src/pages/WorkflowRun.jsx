/**
 * Workflow Run Page
 * Displays the live status of a workflow run.
 * Handles review/pick gates for human approval.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Eye,
  Image,
  Video,
  MessageSquare,
  Wand2,
  ShieldCheck,
  MousePointer2,
  FolderOpen,
  Upload,
  X,
  Loader2,
} from 'lucide-react';
import { Sidebar } from '../components/layout/Sidebar';
import { api } from '../services/api';

const STATUS_STYLES = {
  pending:             { icon: Clock, color: 'text-gray-400', bg: 'bg-gray-500/20', label: 'Pending' },
  running:             { icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/20', label: 'Running', animate: true },
  waiting_for_review:  { icon: Eye, color: 'text-yellow-400', bg: 'bg-yellow-500/20', label: 'Needs Review' },
  completed:           { icon: CheckCircle, color: 'text-green-400', bg: 'bg-green-500/20', label: 'Completed' },
  failed:              { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/20', label: 'Failed' },
  skipped:             { icon: AlertTriangle, color: 'text-gray-400', bg: 'bg-gray-500/20', label: 'Skipped' },
  cancelled:           { icon: XCircle, color: 'text-gray-400', bg: 'bg-gray-500/20', label: 'Cancelled' },
};

const NODE_ICONS = {
  generate_image: Image,
  generate_video: Video,
  edit_bg_remove: Wand2,
  ai_caption: MessageSquare,
  review: ShieldCheck,
  pick: MousePointer2,
  save_to_gallery: FolderOpen,
  export: Upload,
};

function NodeResultCard({ node, result, onApprove }) {
  const statusStyle = STATUS_STYLES[result?.status] || STATUS_STYLES.pending;
  const StatusIcon = statusStyle.icon;
  const NodeIcon = NODE_ICONS[node.node_type] || Image;

  const hasOutput = result?.output && Object.keys(result.output).length > 0;
  const needsReview = result?.status === 'waiting_for_review';

  return (
    <div className={`border border-border rounded-xl overflow-hidden transition-all ${
      needsReview ? 'ring-2 ring-yellow-500/50' : ''
    }`}>
      {/* Header */}
      <div className="bg-surface-elevated px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <NodeIcon className="h-4 w-4 text-text-muted" />
          <span className="text-sm font-medium text-text">{node.label}</span>
          <span className="text-xs text-text-muted capitalize">({node.node_type.replace(/_/g, ' ')})</span>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-medium ${statusStyle.color}`}>
          <StatusIcon className={`h-3.5 w-3.5 ${statusStyle.animate ? 'animate-spin' : ''}`} />
          {statusStyle.label}
        </div>
      </div>

      {/* Output preview */}
      {hasOutput && (
        <div className="px-4 py-3 border-t border-border">
          {/* Image outputs */}
          {result.output.images && (
            <div className="flex gap-2 flex-wrap">
              {result.output.images.map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Output ${i + 1}`}
                  className="h-24 w-24 object-cover rounded-lg border border-border"
                />
              ))}
            </div>
          )}
          {result.output.image && !result.output.images && (
            <img
              src={result.output.image}
              alt="Output"
              className="h-32 w-auto object-cover rounded-lg border border-border"
            />
          )}

          {/* Video output */}
          {result.output.video && (
            <video
              src={result.output.video}
              controls
              className="h-32 rounded-lg border border-border"
            />
          )}

          {/* Media pass-through */}
          {result.output.media && !result.output.image && !result.output.images && !result.output.video && (
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <Image className="h-3.5 w-3.5" />
              <span>Media passed through</span>
            </div>
          )}

          {/* Text output */}
          {result.output.text && (
            <div className="mt-2 bg-surface rounded-lg p-3">
              <p className="text-sm text-text">{result.output.text}</p>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {result?.error && (
        <div className="px-4 py-3 border-t border-border bg-red-500/5">
          <p className="text-xs text-red-400">{result.error}</p>
        </div>
      )}

      {/* Review actions */}
      {needsReview && (
        <div className="px-4 py-3 border-t border-border bg-yellow-500/5">
          {node.node_type === 'pick' && result.output?.images ? (
            <div>
              <p className="text-xs text-yellow-400 font-medium mb-2">Select the best image:</p>
              <div className="flex gap-2 flex-wrap">
                {result.output.images.map((url, i) => (
                  <button
                    key={i}
                    onClick={() => onApprove(node.id, { selected_index: i })}
                    className="relative group"
                  >
                    <img
                      src={url}
                      alt={`Option ${i + 1}`}
                      className="h-20 w-20 object-cover rounded-lg border-2 border-border hover:border-primary transition-colors"
                    />
                    <div className="absolute inset-0 bg-primary/20 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <CheckCircle className="h-6 w-6 text-white" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <p className="text-xs text-yellow-400 font-medium flex-1">
                {node.config?.note || 'Review and approve to continue'}
              </p>
              <button
                onClick={() => onApprove(node.id, {})}
                className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors flex items-center gap-1"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Approve
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function WorkflowRunPage() {
  const { id: workflowId, runId } = useParams();
  const navigate = useNavigate();

  const [run, setRun] = useState(null);
  const [workflow, setWorkflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef(null);

  const fetchRun = useCallback(async () => {
    try {
      const [runData, wfData] = await Promise.all([
        api.getWorkflowRun(runId),
        api.getWorkflow(workflowId),
      ]);
      setRun(runData);
      setWorkflow(wfData);
      return runData;
    } catch (err) {
      console.error('Failed to fetch run:', err);
      return null;
    } finally {
      setLoading(false);
    }
  }, [runId, workflowId]);

  // Initial load + polling
  useEffect(() => {
    fetchRun();

    // Poll every 3 seconds while running
    pollRef.current = setInterval(async () => {
      const data = await fetchRun();
      if (data && ['completed', 'failed', 'cancelled'].includes(data.status)) {
        clearInterval(pollRef.current);
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchRun]);

  const handleApprove = async (nodeId, data) => {
    try {
      await api.approveWorkflowNode(runId, nodeId, data);
      // Immediately re-fetch
      await fetchRun();
    } catch (err) {
      alert('Failed to approve: ' + (err.message || 'Unknown error'));
    }
  };

  const handleCancel = async () => {
    if (!confirm('Cancel this workflow run?')) return;
    try {
      await api.cancelWorkflowRun(runId);
      await fetchRun();
    } catch (err) {
      alert('Failed to cancel: ' + (err.message || 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="ml-64 flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </main>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="ml-64 flex items-center justify-center h-screen">
          <p className="text-text-muted">Run not found</p>
        </main>
      </div>
    );
  }

  const runStatusStyle = STATUS_STYLES[run.status] || STATUS_STYLES.pending;
  const RunStatusIcon = runStatusStyle.icon;

  // Match node results to nodes in order
  const orderedNodes = (workflow?.nodes || []).map((node) => {
    const result = (run.node_results || []).find((r) => r.node_id === node.id);
    return { node, result };
  });

  const isFinished = ['completed', 'failed', 'cancelled'].includes(run.status);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 p-8">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate(`/workflows/${workflowId}`)}
                className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-elevated transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-text">{workflow?.name || 'Workflow'} Run</h1>
                <div className={`flex items-center gap-1.5 text-sm mt-0.5 ${runStatusStyle.color}`}>
                  <RunStatusIcon className={`h-4 w-4 ${runStatusStyle.animate ? 'animate-spin' : ''}`} />
                  {runStatusStyle.label}
                  {run.credits_used > 0 && (
                    <span className="text-text-muted ml-3">{run.credits_used} credits used</span>
                  )}
                </div>
              </div>
            </div>

            {!isFinished && (
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 border border-red-500/50 text-red-400 rounded-lg text-sm hover:bg-red-500/10 transition-colors flex items-center gap-1.5"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            )}
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex items-center gap-1">
              {orderedNodes.map(({ result }, i) => {
                const status = result?.status || 'pending';
                const colors = {
                  pending: 'bg-gray-600',
                  running: 'bg-blue-500 animate-pulse',
                  waiting_for_review: 'bg-yellow-500',
                  completed: 'bg-green-500',
                  failed: 'bg-red-500',
                  skipped: 'bg-gray-600',
                };
                return (
                  <div
                    key={i}
                    className={`h-2 flex-1 rounded-full ${colors[status] || 'bg-gray-600'} transition-colors`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-text-muted mt-1">
              <span>
                {orderedNodes.filter((n) => n.result?.status === 'completed').length} / {orderedNodes.length} completed
              </span>
              {run.started_at && (
                <span>Started {new Date(run.started_at).toLocaleString()}</span>
              )}
            </div>
          </div>

          {/* Node results */}
          <div className="space-y-3">
            {orderedNodes.map(({ node, result }) => (
              <NodeResultCard
                key={node.id}
                node={node}
                result={result}
                onApprove={handleApprove}
              />
            ))}
          </div>

          {/* Finished summary */}
          {isFinished && (
            <div className="mt-6 p-4 bg-surface-elevated border border-border rounded-xl text-center">
              <p className={`text-sm font-medium ${runStatusStyle.color}`}>
                Workflow {run.status === 'completed' ? 'completed successfully' : run.status}
              </p>
              {run.credits_used > 0 && (
                <p className="text-xs text-text-muted mt-1">Total credits used: {run.credits_used}</p>
              )}
              <div className="flex gap-3 justify-center mt-4">
                <Link
                  to={`/workflows/${workflowId}`}
                  className="px-4 py-2 border border-border rounded-lg text-sm text-text hover:bg-surface transition-colors"
                >
                  Back to Editor
                </Link>
                <Link
                  to="/gallery"
                  className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover transition-colors"
                >
                  View Gallery
                </Link>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
