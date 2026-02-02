/**
 * Workflows List Page
 * Shows all workflows for the currently selected model (or templates).
 * Allows creating, cloning, archiving, and navigating to the editor.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  GitBranch,
  Play,
  Copy,
  Archive,
  MoreVertical,
  Clock,
  Layers,
  FileText,
  CalendarClock,
  Hash,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useModel } from '../context/ModelContext';
import { useAuth } from '../context/AuthContext';
import { Sidebar } from '../components/layout/Sidebar';
import { api } from '../services/api';

function formatNextRun(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = date - now;

  if (diffMs < 0) return 'overdue';
  if (diffMs < 60000) return 'in <1 min';
  if (diffMs < 3600000) return `in ${Math.round(diffMs / 60000)} min`;
  if (diffMs < 86400000) {
    const hours = Math.floor(diffMs / 3600000);
    return `in ${hours}h`;
  }
  const days = Math.floor(diffMs / 86400000);
  if (days === 1) return 'tomorrow';
  return `in ${days}d`;
}

function formatScheduleLabel(config) {
  if (!config) return '';
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  if (config.frequency === 'daily') return `Daily at ${config.time}`;
  if (config.frequency === 'weekly' || config.frequency === 'specific_days') {
    const days = (config.days || []).map((d) => dayNames[d]).join(', ');
    return `${days} at ${config.time}`;
  }
  return config.time || '';
}

function WorkflowCard({ workflow, onOpen, onClone, onArchive, onRun, onToggleTrigger }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [toggling, setToggling] = useState(false);

  const statusColors = {
    draft: 'bg-gray-500',
    active: 'bg-green-500',
    paused: 'bg-yellow-500',
    archived: 'bg-red-500',
  };

  const lastRunStatus = workflow.last_run?.status;
  const lastRunColors = {
    running: 'text-blue-400',
    waiting_for_review: 'text-yellow-400',
    completed: 'text-green-400',
    failed: 'text-red-400',
    cancelled: 'text-gray-400',
  };

  const trigger = workflow.trigger;
  const nextRun = trigger?.next_trigger_at ? formatNextRun(trigger.next_trigger_at) : null;

  const handleToggle = async (e) => {
    e.stopPropagation();
    if (toggling || !trigger) return;
    setToggling(true);
    try {
      await onToggleTrigger(trigger.id, !trigger.enabled);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="bg-surface-elevated border border-border rounded-xl p-5 hover:border-primary/50 transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <GitBranch className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-text">{workflow.name}</h3>
            {workflow.description && (
              <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{workflow.description}</p>
            )}
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface transition-colors opacity-0 group-hover:opacity-100"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 bg-surface border border-border rounded-lg shadow-xl py-1 w-40">
                <button
                  onClick={() => { onClone(workflow); setMenuOpen(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-text hover:bg-surface-elevated flex items-center gap-2"
                >
                  <Copy className="h-3.5 w-3.5" /> Copy to...
                </button>
                <button
                  onClick={() => { onArchive(workflow); setMenuOpen(false); }}
                  className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-surface-elevated flex items-center gap-2"
                >
                  <Archive className="h-3.5 w-3.5" /> Archive
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs text-text-muted mb-3">
        <span className="flex items-center gap-1">
          <Layers className="h-3.5 w-3.5" />
          {workflow.node_count} nodes
        </span>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium text-white ${statusColors[workflow.status] || 'bg-gray-500'}`}>
          {workflow.status}
        </span>
        {workflow.last_run && (
          <span className={`flex items-center gap-1 ${lastRunColors[lastRunStatus] || 'text-text-muted'}`}>
            <Clock className="h-3.5 w-3.5" />
            {lastRunStatus}
          </span>
        )}
        {workflow.total_runs > 0 && (
          <span className="flex items-center gap-1">
            <Hash className="h-3.5 w-3.5" />
            {workflow.total_runs} run{workflow.total_runs !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Schedule row */}
      {trigger && (
        <div className="flex items-center justify-between mb-3 px-3 py-2 rounded-lg bg-surface border border-border">
          <div className="flex items-center gap-2 text-xs">
            <CalendarClock className={`h-3.5 w-3.5 ${trigger.enabled ? 'text-green-400' : 'text-text-muted'}`} />
            <span className={trigger.enabled ? 'text-text' : 'text-text-muted line-through'}>
              {formatScheduleLabel(trigger.schedule_config)}
            </span>
            {trigger.enabled && nextRun && (
              <span className="text-text-muted">
                · next {nextRun}
              </span>
            )}
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className="flex-shrink-0 ml-2"
            title={trigger.enabled ? 'Disable schedule' : 'Enable schedule'}
          >
            {trigger.enabled ? (
              <ToggleRight className={`h-5 w-5 text-green-400 ${toggling ? 'opacity-50' : 'hover:text-green-300'}`} />
            ) : (
              <ToggleLeft className={`h-5 w-5 text-text-muted ${toggling ? 'opacity-50' : 'hover:text-text'}`} />
            )}
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={() => onOpen(workflow)}
          className="flex-1 px-3 py-2 bg-surface border border-border rounded-lg text-sm text-text hover:bg-surface-elevated transition-colors text-center"
        >
          Edit
        </button>
        <button
          onClick={() => onRun(workflow)}
          className="px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover transition-colors flex items-center gap-1.5"
        >
          <Play className="h-3.5 w-3.5" /> Run
        </button>
      </div>
    </div>
  );
}

function CloneModal({ workflow, models, onClose, onClone }) {
  const [targetModelId, setTargetModelId] = useState('');
  const [asTemplate, setAsTemplate] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClone = async () => {
    setLoading(true);
    try {
      await onClone(workflow.id, asTemplate ? { as_template: true } : { target_model_id: targetModelId });
      onClose();
    } catch (err) {
      console.error('Clone failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-text mb-4">Copy Workflow</h2>
        <p className="text-sm text-text-muted mb-4">
          Copy <strong>"{workflow.name}"</strong> to another model or save as a reusable template.
        </p>

        <div className="space-y-3 mb-6">
          <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-surface-elevated transition-colors">
            <input
              type="radio"
              checked={!asTemplate}
              onChange={() => setAsTemplate(false)}
              className="text-primary"
            />
            <div>
              <p className="text-sm font-medium text-text">Copy to Model</p>
              <p className="text-xs text-text-muted">Assign this workflow to a specific model</p>
            </div>
          </label>

          {!asTemplate && (
            <select
              value={targetModelId}
              onChange={(e) => setTargetModelId(e.target.value)}
              className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text"
            >
              <option value="">Select a model...</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}

          <label className="flex items-center gap-3 p-3 border border-border rounded-lg cursor-pointer hover:bg-surface-elevated transition-colors">
            <input
              type="radio"
              checked={asTemplate}
              onChange={() => setAsTemplate(true)}
              className="text-primary"
            />
            <div>
              <p className="text-sm font-medium text-text">Save as Template</p>
              <p className="text-xs text-text-muted">Create a reusable template not tied to any model</p>
            </div>
          </label>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-text hover:bg-surface-elevated transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleClone}
            disabled={loading || (!asTemplate && !targetModelId)}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {loading ? 'Copying...' : 'Copy'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateModal({ models, selectedModel, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isTemplate, setIsTemplate] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setLoading(true);
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || null,
        model_id: isTemplate ? null : selectedModel?.id,
        is_template: isTemplate,
      });
      onClose();
    } catch (err) {
      console.error('Create failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-text mb-4">New Workflow</h2>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Daily Lingerie Set"
              className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-1">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this workflow do?"
              rows={2}
              className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {selectedModel && (
            <label className="flex items-center gap-2 text-sm text-text-muted">
              <input
                type="checkbox"
                checked={isTemplate}
                onChange={(e) => setIsTemplate(e.target.checked)}
                className="text-primary"
              />
              Create as template (not tied to {selectedModel.name})
            </label>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-text hover:bg-surface-elevated transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="flex-1 px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function WorkflowsPage() {
  const navigate = useNavigate();
  const { selectedModel, models } = useModel();
  const { isAdmin } = useAuth();
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [cloneTarget, setCloneTarget] = useState(null);
  const [viewMode, setViewMode] = useState('model'); // 'model' or 'templates'

  const fetchWorkflows = useCallback(async () => {
    // In model mode, require a selected model — don't fetch all agency workflows
    if (viewMode === 'model' && !selectedModel) {
      setWorkflows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = {};
      if (viewMode === 'templates') {
        params.is_template = 'true';
      } else {
        params.model_id = selectedModel.id;
      }
      const data = await api.getWorkflows(params);
      setWorkflows(data.workflows || []);
    } catch (err) {
      console.error('Failed to fetch workflows:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedModel, viewMode]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const handleCreate = async (data) => {
    const workflow = await api.createWorkflow(data);
    navigate(`/workflows/${workflow.id}`);
  };

  const handleClone = async (workflowId, data) => {
    const cloned = await api.cloneWorkflow(workflowId, data);
    await fetchWorkflows();
    navigate(`/workflows/${cloned.id}`);
  };

  const handleArchive = async (workflow) => {
    if (!confirm(`Archive "${workflow.name}"? You can restore it later.`)) return;
    await api.deleteWorkflow(workflow.id);
    await fetchWorkflows();
  };

  const handleRun = async (workflow) => {
    try {
      const run = await api.startWorkflowRun(workflow.id);
      navigate(`/workflows/${workflow.id}/runs/${run.id}`);
    } catch (err) {
      alert(err.message || 'Failed to start workflow');
    }
  };

  const handleToggleTrigger = async (triggerId, enabled) => {
    try {
      await api.updateWorkflowTrigger(triggerId, { enabled });
      // Optimistically update local state
      setWorkflows((prev) =>
        prev.map((w) => {
          if (w.trigger?.id === triggerId) {
            return {
              ...w,
              trigger: { ...w.trigger, enabled },
              triggers_enabled: enabled,
            };
          }
          return w;
        })
      );
    } catch (err) {
      console.error('Failed to toggle trigger:', err);
      // Refetch to restore correct state
      fetchWorkflows();
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-text">Workflows</h1>
              <p className="text-sm text-text-muted mt-1">
                {viewMode === 'templates'
                  ? 'Reusable workflow templates'
                  : selectedModel
                    ? `Automation pipelines for ${selectedModel.name}`
                    : 'Select a model to see workflows'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* View toggle */}
              <div className="flex bg-surface-elevated border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode('model')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'model' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
                  }`}
                >
                  Model
                </button>
                <button
                  onClick={() => setViewMode('templates')}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    viewMode === 'templates' ? 'bg-primary text-white' : 'text-text-muted hover:text-text'
                  }`}
                >
                  Templates
                </button>
              </div>

              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
              >
                <Plus className="h-4 w-4" />
                New Workflow
              </button>
            </div>
          </div>

          {/* Workflows grid */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : workflows.length === 0 ? (
            <div className="text-center py-20">
              <GitBranch className="h-12 w-12 text-text-muted mx-auto mb-4" />
              <h3 className="text-lg font-medium text-text mb-2">No workflows yet</h3>
              <p className="text-sm text-text-muted mb-6">
                {viewMode === 'templates'
                  ? 'Create a template to reuse across models.'
                  : selectedModel
                    ? `Create your first automation pipeline for ${selectedModel.name}.`
                    : 'Select a model from the sidebar to get started.'}
              </p>
              {(selectedModel || viewMode === 'templates') && (
                <button
                  onClick={() => setShowCreate(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-hover transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Create Workflow
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workflows.map((w) => (
                <WorkflowCard
                  key={w.id}
                  workflow={w}
                  onOpen={(wf) => navigate(`/workflows/${wf.id}`)}
                  onClone={(wf) => setCloneTarget(wf)}
                  onArchive={handleArchive}
                  onRun={handleRun}
                  onToggleTrigger={handleToggleTrigger}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showCreate && (
        <CreateModal
          models={models}
          selectedModel={selectedModel}
          onClose={() => setShowCreate(false)}
          onCreate={handleCreate}
        />
      )}
      {cloneTarget && (
        <CloneModal
          workflow={cloneTarget}
          models={models}
          onClose={() => setCloneTarget(null)}
          onClone={handleClone}
        />
      )}
    </div>
  );
}
