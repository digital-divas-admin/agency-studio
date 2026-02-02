/**
 * Workflow Editor Page
 * React Flow-based node graph editor for building workflow pipelines.
 * Includes node palette, config panel, and save/run controls.
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Panel,
  MarkerType,
  Handle,
  Position,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Save,
  Play,
  ArrowLeft,
  Plus,
  Image,
  Video,
  Wand2,
  MessageSquare,
  ShieldCheck,
  MousePointer2,
  FolderOpen,
  Upload,
  X,
  ChevronDown,
  Variable,
  Clock,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Sidebar } from '../components/layout/Sidebar';
import { api } from '../services/api';
import { useModel } from '../context/ModelContext';

// =============================================
// Custom Node Component
// =============================================

const CATEGORY_STYLES = {
  generation:   { bg: 'bg-purple-500/20', border: 'border-purple-500/50', icon: 'text-purple-400', header: 'bg-purple-500/10' },
  editing:      { bg: 'bg-blue-500/20', border: 'border-blue-500/50', icon: 'text-blue-400', header: 'bg-blue-500/10' },
  ai:           { bg: 'bg-teal-500/20', border: 'border-teal-500/50', icon: 'text-teal-400', header: 'bg-teal-500/10' },
  flow_control: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/50', icon: 'text-yellow-400', header: 'bg-yellow-500/10' },
  output:       { bg: 'bg-green-500/20', border: 'border-green-500/50', icon: 'text-green-400', header: 'bg-green-500/10' },
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

function WorkflowNode({ data, selected }) {
  const style = CATEGORY_STYLES[data.category] || CATEGORY_STYLES.generation;
  const Icon = NODE_ICONS[data.nodeType] || Image;

  return (
    <div className={`rounded-xl border-2 ${selected ? 'border-primary ring-2 ring-primary/30' : style.border} bg-surface shadow-lg min-w-[200px] transition-all`}>
      {/* Header */}
      <div className={`${style.header} px-3 py-2 rounded-t-[10px] flex items-center gap-2`}>
        <Icon className={`h-4 w-4 ${style.icon}`} />
        <span className="text-sm font-medium text-text truncate">{data.label}</span>
      </div>

      {/* Ports */}
      <div className="px-3 py-2 space-y-1">
        {data.inputs?.map((port) => (
          <div key={port.name} className="relative flex items-center gap-1.5 text-xs text-text-muted">
            <Handle
              type="target"
              position={Position.Left}
              id={port.name}
              className="!w-2.5 !h-2.5 !bg-text-muted/50 !border !border-surface !-left-[13px]"
            />
            <span>{port.label}{port.optional ? '' : ' *'}</span>
          </div>
        ))}
        {data.outputs?.map((port) => (
          <div key={port.name} className="relative flex items-center justify-end gap-1.5 text-xs text-text-muted">
            <span>{port.label}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={port.name}
              className="!w-2.5 !h-2.5 !bg-text-muted/50 !border !border-surface !-right-[13px]"
            />
          </div>
        ))}
      </div>

      {/* Config summary */}
      {data.configSummary && (
        <div className="px-3 pb-2 border-t border-border/50 pt-1.5">
          <p className="text-[10px] text-text-muted truncate">{data.configSummary}</p>
        </div>
      )}
    </div>
  );
}

const nodeTypes = {
  workflowNode: WorkflowNode,
};

// =============================================
// Node Palette (left sidebar)
// =============================================

function NodePalette({ nodeTypeDefs, onAddNode }) {
  const categories = useMemo(() => {
    const grouped = {};
    for (const nt of nodeTypeDefs) {
      if (!grouped[nt.category]) grouped[nt.category] = [];
      grouped[nt.category].push(nt);
    }
    return Object.entries(grouped).sort((a, b) => {
      const order = { generation: 1, editing: 2, ai: 3, flow_control: 4, output: 5 };
      return (order[a[0]] || 99) - (order[b[0]] || 99);
    });
  }, [nodeTypeDefs]);

  const categoryLabels = {
    generation: 'Generation',
    editing: 'Editing',
    ai: 'AI',
    flow_control: 'Flow Control',
    output: 'Output',
  };

  return (
    <div className="w-56 bg-surface border-r border-border overflow-y-auto p-3 space-y-4">
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider px-1">Add Nodes</p>
      {categories.map(([cat, types]) => (
        <div key={cat}>
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider px-1 mb-1.5">
            {categoryLabels[cat] || cat}
          </p>
          <div className="space-y-1">
            {types.map((nt) => {
              const Icon = NODE_ICONS[nt.type] || Image;
              const style = CATEGORY_STYLES[nt.category] || CATEGORY_STYLES.generation;
              return (
                <button
                  key={nt.type}
                  onClick={() => onAddNode(nt)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-text hover:bg-surface-elevated transition-colors text-left`}
                >
                  <div className={`h-7 w-7 rounded-md ${style.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`h-3.5 w-3.5 ${style.icon}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{nt.label}</p>
                    {nt.estimatedCredits > 0 && (
                      <p className="text-[10px] text-text-muted">{nt.estimatedCredits} credits</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// =============================================
// Node Config Panel (right sidebar)
// =============================================

const TEMPLATE_VARIABLES = [
  { key: '{{model.name}}', label: 'Model Name' },
  { key: '{{model.of_handle}}', label: 'OF Handle' },
  { key: '{{model.notes}}', label: 'Notes' },
  { key: '{{model.lora_name}}', label: 'LoRA Name' },
  { key: '{{model.lora_strength}}', label: 'LoRA Strength' },
  { key: '{{model.lora_trigger}}', label: 'Trigger Word' },
];

function VariableInsert({ onInsert }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[10px] text-primary hover:text-primary-hover transition-colors"
      >
        <Variable className="h-3 w-3" />
        Insert variable
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-5 z-20 bg-surface border border-border rounded-lg shadow-xl py-1 w-48">
            {TEMPLATE_VARIABLES.map((v) => (
              <button
                key={v.key}
                onClick={() => { onInsert(v.key); setOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-xs text-text hover:bg-surface-elevated flex justify-between"
              >
                <span>{v.label}</span>
                <span className="text-text-muted font-mono">{v.key}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ConfigPanel({ node, nodeTypeDefs, onUpdateConfig, onClose }) {
  if (!node) return null;

  const typeDef = nodeTypeDefs.find((nt) => nt.type === node.data.nodeType);
  if (!typeDef) return null;

  const config = node.data.config || {};
  const schema = typeDef.configSchema || {};

  const handleChange = (key, value) => {
    onUpdateConfig(node.id, { ...config, [key]: value });
  };

  const handleInsertVariable = (key, variable) => {
    const current = config[key] || '';
    handleChange(key, current + variable);
  };

  return (
    <div className="w-72 bg-surface border-l border-border overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-text">Configure Node</h3>
        <button onClick={onClose} className="p-1 rounded text-text-muted hover:text-text">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Label */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-text-muted mb-1">Label</label>
        <input
          type="text"
          value={node.data.label}
          onChange={(e) => onUpdateConfig(node.id, config, e.target.value)}
          className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>

      {/* Config fields */}
      {Object.entries(schema).map(([key, fieldDef]) => (
        <div key={key} className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-text-muted">{fieldDef.label}</label>
            {fieldDef.supportsVariables && (
              <VariableInsert onInsert={(v) => handleInsertVariable(key, v)} />
            )}
          </div>

          {fieldDef.type === 'textarea' && (
            <textarea
              value={config[key] ?? fieldDef.default ?? ''}
              onChange={(e) => handleChange(key, e.target.value)}
              rows={3}
              className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary resize-none font-mono"
              placeholder={fieldDef.label}
            />
          )}

          {fieldDef.type === 'select' && (
            <select
              value={config[key] ?? fieldDef.default ?? ''}
              onChange={(e) => handleChange(key, e.target.value)}
              className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {fieldDef.options.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          )}

          {fieldDef.type === 'number' && (
            <input
              type="number"
              value={config[key] ?? fieldDef.default ?? ''}
              onChange={(e) => handleChange(key, parseFloat(e.target.value) || 0)}
              min={fieldDef.min}
              max={fieldDef.max}
              className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}

          {fieldDef.type === 'tags' && (
            <input
              type="text"
              value={(config[key] || []).join(', ')}
              onChange={(e) => handleChange(key, e.target.value.split(',').map((t) => t.trim()).filter(Boolean))}
              placeholder="tag1, tag2, tag3"
              className="w-full bg-surface-elevated border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}
        </div>
      ))}

      {Object.keys(schema).length === 0 && (
        <p className="text-xs text-text-muted italic">This node has no configurable options.</p>
      )}
    </div>
  );
}

// =============================================
// Trigger Panel (Schedule modal)
// =============================================

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Australia/Sydney',
  'UTC',
];

function formatNextTrigger(isoString) {
  if (!isoString) return 'Not scheduled';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return 'Invalid date';
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function TriggerPanel({ workflowId, onClose }) {
  const [triggers, setTriggers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(null); // triggerId being saved

  // New trigger form state
  const [showForm, setShowForm] = useState(false);
  const [frequency, setFrequency] = useState('daily');
  const [days, setDays] = useState([1, 3, 5]); // Mon, Wed, Fri
  const [time, setTime] = useState('10:00');
  const [timezone, setTimezone] = useState(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );

  const fetchTriggers = useCallback(async () => {
    try {
      const data = await api.getWorkflowTriggers(workflowId);
      setTriggers(data.triggers || []);
    } catch (err) {
      console.error('Failed to fetch triggers:', err);
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    fetchTriggers();
  }, [fetchTriggers]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const schedule_config = {
        frequency,
        time,
        timezone,
      };
      if (frequency === 'weekly' || frequency === 'specific_days') {
        schedule_config.days = [...days].sort((a, b) => a - b);
      }

      await api.createWorkflowTrigger(workflowId, {
        trigger_type: 'scheduled',
        schedule_config,
        enabled: true,
      });

      setShowForm(false);
      await fetchTriggers();
    } catch (err) {
      alert(err.message || 'Failed to create trigger');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (trigger) => {
    setSaving(trigger.id);
    try {
      await api.updateWorkflowTrigger(trigger.id, {
        enabled: !trigger.enabled,
      });
      await fetchTriggers();
    } catch (err) {
      alert(err.message || 'Failed to update trigger');
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (trigger) => {
    if (!confirm('Delete this scheduled trigger?')) return;
    try {
      await api.deleteWorkflowTrigger(trigger.id);
      await fetchTriggers();
    } catch (err) {
      alert(err.message || 'Failed to delete trigger');
    }
  };

  const toggleDay = (day) => {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-border rounded-xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold text-text">Scheduled Triggers</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded text-text-muted hover:text-text">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Existing triggers */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : triggers.length === 0 && !showForm ? (
          <div className="text-center py-8">
            <Clock className="h-10 w-10 text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text-muted mb-4">
              No scheduled triggers yet. Add one to automatically run this workflow on a schedule.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mb-4">
            {triggers.map((trigger) => (
              <div
                key={trigger.id}
                className={`border rounded-lg p-3 ${
                  trigger.enabled ? 'border-primary/40 bg-primary/5' : 'border-border bg-surface-elevated'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(trigger)}
                      disabled={saving === trigger.id}
                      className="text-text-muted hover:text-text transition-colors"
                    >
                      {trigger.enabled ? (
                        <ToggleRight className="h-5 w-5 text-primary" />
                      ) : (
                        <ToggleLeft className="h-5 w-5" />
                      )}
                    </button>
                    <span className={`text-sm font-medium ${trigger.enabled ? 'text-text' : 'text-text-muted'}`}>
                      {trigger.schedule_config?.frequency === 'daily' && 'Daily'}
                      {trigger.schedule_config?.frequency === 'weekly' && 'Weekly'}
                      {trigger.schedule_config?.frequency === 'specific_days' && 'Specific Days'}
                      {' at '}
                      {trigger.schedule_config?.time || '??:??'}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDelete(trigger)}
                    className="p-1 rounded text-text-muted hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="text-xs text-text-muted space-y-1 ml-7">
                  {(trigger.schedule_config?.frequency === 'weekly' ||
                    trigger.schedule_config?.frequency === 'specific_days') && (
                    <p>
                      Days: {(trigger.schedule_config.days || []).map((d) => DAY_LABELS[d]).join(', ')}
                    </p>
                  )}
                  <p>Timezone: {trigger.schedule_config?.timezone || 'UTC'}</p>
                  <p>
                    Next run: {trigger.enabled ? formatNextTrigger(trigger.next_trigger_at) : 'Paused'}
                  </p>
                  {trigger.last_triggered_at && (
                    <p>Last run: {formatNextTrigger(trigger.last_triggered_at)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* New trigger form */}
        {showForm ? (
          <div className="border border-border rounded-lg p-4 bg-surface-elevated">
            <h3 className="text-sm font-semibold text-text mb-3">New Schedule</h3>

            {/* Frequency */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-text-muted mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="specific_days">Specific Days</option>
              </select>
            </div>

            {/* Day picker */}
            {(frequency === 'weekly' || frequency === 'specific_days') && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-text-muted mb-1">Days</label>
                <div className="flex gap-1">
                  {DAY_LABELS.map((label, i) => (
                    <button
                      key={i}
                      onClick={() => toggleDay(i)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        days.includes(i)
                          ? 'bg-primary text-white'
                          : 'bg-surface border border-border text-text-muted hover:text-text'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Time */}
            <div className="mb-3">
              <label className="block text-xs font-medium text-text-muted mb-1">Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* Timezone */}
            <div className="mb-4">
              <label className="block text-xs font-medium text-text-muted mb-1">Timezone</label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 px-3 py-2 border border-border rounded-lg text-sm text-text hover:bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={
                  creating ||
                  ((frequency === 'weekly' || frequency === 'specific_days') && days.length === 0)
                }
                className="flex-1 px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
              >
                {creating ? 'Creating...' : 'Create Schedule'}
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-dashed border-border rounded-lg text-sm text-text-muted hover:text-text hover:border-primary/50 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Schedule
          </button>
        )}
      </div>
    </div>
  );
}

// =============================================
// Main Editor Page
// =============================================

export function WorkflowEditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { selectedModel } = useModel();

  const [workflow, setWorkflow] = useState(null);
  const [nodeTypeDefs, setNodeTypeDefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  const [showTriggers, setShowTriggers] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const nodeCounter = useRef(0);

  // Load workflow and node types
  useEffect(() => {
    async function load() {
      try {
        const [wfData, ntData] = await Promise.all([
          api.getWorkflow(id),
          api.getNodeTypes(),
        ]);

        setWorkflow(wfData);
        setNodeTypeDefs(ntData.nodeTypes || []);

        // Convert DB nodes to React Flow format
        const rfNodes = (wfData.nodes || []).map((n) => {
          const typeDef = (ntData.nodeTypes || []).find((nt) => nt.type === n.node_type);
          return {
            id: n.id,
            type: 'workflowNode',
            position: { x: n.position_x, y: n.position_y },
            data: {
              label: n.label,
              nodeType: n.node_type,
              category: typeDef?.category || 'generation',
              config: n.config || {},
              inputs: typeDef?.inputs || [],
              outputs: typeDef?.outputs || [],
              configSummary: buildConfigSummary(n.config, n.node_type),
            },
          };
        });

        // Convert DB edges to React Flow format
        const rfEdges = (wfData.edges || []).map((e) => ({
          id: e.id,
          source: e.source_node_id,
          sourceHandle: e.source_port,
          target: e.target_node_id,
          targetHandle: e.target_port,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: '#6366f1', strokeWidth: 2 },
        }));

        setNodes(rfNodes);
        setEdges(rfEdges);
        nodeCounter.current = rfNodes.length;
      } catch (err) {
        console.error('Failed to load workflow:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [id, setNodes, setEdges]);

  // Track dirty state
  const handleNodesChange = useCallback((changes) => {
    onNodesChange(changes);
    setDirty(true);
  }, [onNodesChange]);

  const handleEdgesChange = useCallback((changes) => {
    onEdgesChange(changes);
    setDirty(true);
  }, [onEdgesChange]);

  const handleConnect = useCallback((params) => {
    setEdges((eds) => addEdge({
      ...params,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#6366f1', strokeWidth: 2 },
    }, eds));
    setDirty(true);
  }, [setEdges]);

  // Add node from palette
  const handleAddNode = useCallback((typeDef) => {
    const newId = `node-${Date.now()}-${nodeCounter.current++}`;
    const newNode = {
      id: newId,
      type: 'workflowNode',
      position: { x: 300 + Math.random() * 200, y: 200 + Math.random() * 200 },
      data: {
        label: typeDef.label,
        nodeType: typeDef.type,
        category: typeDef.category,
        config: buildDefaultConfig(typeDef.configSchema),
        inputs: typeDef.inputs || [],
        outputs: typeDef.outputs || [],
        configSummary: '',
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(newId);
    setDirty(true);
  }, [setNodes]);

  // Update node config from the config panel
  const handleUpdateConfig = useCallback((nodeId, newConfig, newLabel) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          data: {
            ...n.data,
            ...(newLabel !== undefined && { label: newLabel }),
            config: newConfig,
            configSummary: buildConfigSummary(newConfig, n.data.nodeType),
          },
        };
      })
    );
    setDirty(true);
  }, [setNodes]);

  // Save graph
  const handleSave = useCallback(async () => {
    if (!workflow) return;
    setSaving(true);
    try {
      // Convert React Flow format back to DB format
      const dbNodes = nodes.map((n) => ({
        id: n.id,
        node_type: n.data.nodeType,
        label: n.data.label,
        config: n.data.config || {},
        position_x: n.position.x,
        position_y: n.position.y,
      }));

      const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));
      const dbEdges = edges.map((e) => {
        const sourceNode = nodeMap[e.source];
        const targetNode = nodeMap[e.target];
        return {
          source_node_id: e.source,
          source_port: e.sourceHandle || sourceNode?.data?.outputs?.[0]?.name || 'output',
          target_node_id: e.target,
          target_port: e.targetHandle || targetNode?.data?.inputs?.[0]?.name || 'input',
        };
      });

      const saved = await api.saveWorkflowGraph(workflow.id, { nodes: dbNodes, edges: dbEdges });

      // Update node IDs from the save response
      if (saved.nodes) {
        const idMap = new Map();
        dbNodes.forEach((dn, i) => {
          if (saved.nodes[i]) {
            idMap.set(dn.id, saved.nodes[i].id);
          }
        });

        setNodes((nds) =>
          nds.map((n) => ({
            ...n,
            id: idMap.get(n.id) || n.id,
          }))
        );

        setEdges((eds) =>
          eds.map((e) => ({
            ...e,
            source: idMap.get(e.source) || e.source,
            target: idMap.get(e.target) || e.target,
          }))
        );
      }

      setDirty(false);
    } catch (err) {
      console.error('Failed to save:', err);
      alert('Failed to save workflow: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  }, [workflow, nodes, edges, setNodes, setEdges]);

  // Run workflow
  const handleRun = useCallback(async () => {
    // Save first if dirty
    if (dirty) await handleSave();

    try {
      const run = await api.startWorkflowRun(workflow.id);
      navigate(`/workflows/${workflow.id}/runs/${run.id}`);
    } catch (err) {
      alert(err.message || 'Failed to start workflow');
    }
  }, [workflow, dirty, handleSave, navigate]);

  // Node selection
  const handleNodeClick = useCallback((_, node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId),
    [nodes, selectedNodeId]
  );

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

  if (!workflow) {
    return (
      <div className="min-h-screen bg-background">
        <Sidebar />
        <main className="ml-64 flex items-center justify-center h-screen">
          <p className="text-text-muted">Workflow not found</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="ml-64 h-screen flex flex-col">
        {/* Top bar */}
        <div className="h-14 bg-surface border-b border-border flex items-center justify-between px-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/workflows')}
              className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-elevated transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <h2 className="text-sm font-semibold text-text">{workflow.name}</h2>
              <p className="text-[10px] text-text-muted">
                {workflow.is_template ? 'Template' : selectedModel?.name || 'No model'}
                {dirty && ' (unsaved changes)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !dirty}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm text-text hover:bg-surface-elevated disabled:opacity-50 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => setShowTriggers(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm text-text hover:bg-surface-elevated transition-colors"
            >
              <Clock className="h-3.5 w-3.5" />
              Schedule
            </button>
            <button
              onClick={handleRun}
              disabled={nodes.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-sm hover:bg-primary-hover disabled:opacity-50 transition-colors"
            >
              <Play className="h-3.5 w-3.5" />
              Run
            </button>
          </div>
        </div>

        {/* Editor area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Node palette */}
          <NodePalette nodeTypeDefs={nodeTypeDefs} onAddNode={handleAddNode} />

          {/* Canvas */}
          <div className="flex-1 relative">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={handleNodesChange}
              onEdgesChange={handleEdgesChange}
              onConnect={handleConnect}
              onNodeClick={handleNodeClick}
              onPaneClick={handlePaneClick}
              nodeTypes={nodeTypes}
              fitView
              deleteKeyCode="Delete"
              className="bg-background"
            >
              <Background gap={20} size={1} color="#374151" />
              <Controls className="!bg-surface !border-border !rounded-lg [&>button]:!bg-surface [&>button]:!border-border [&>button]:!text-text-muted [&>button:hover]:!bg-surface-elevated" />
              <MiniMap
                className="!bg-surface !border-border !rounded-lg"
                nodeColor="#6366f1"
                maskColor="rgba(0,0,0,0.4)"
              />
            </ReactFlow>
          </div>

          {/* Config panel */}
          {selectedNode && (
            <ConfigPanel
              node={selectedNode}
              nodeTypeDefs={nodeTypeDefs}
              onUpdateConfig={handleUpdateConfig}
              onClose={() => setSelectedNodeId(null)}
            />
          )}
        </div>

        {/* Trigger panel modal */}
        {showTriggers && (
          <TriggerPanel
            workflowId={id}
            onClose={() => setShowTriggers(false)}
          />
        )}
      </main>
    </div>
  );
}

// =============================================
// Helpers
// =============================================

function buildDefaultConfig(schema) {
  if (!schema) return {};
  const config = {};
  for (const [key, def] of Object.entries(schema)) {
    config[key] = def.default ?? '';
  }
  return config;
}

function buildConfigSummary(config, nodeType) {
  if (!config) return '';
  const parts = [];
  if (config.model) parts.push(config.model);
  if (config.prompt) parts.push(config.prompt.substring(0, 40) + (config.prompt.length > 40 ? '...' : ''));
  if (config.platform) parts.push(config.platform);
  if (config.instruction) parts.push(config.instruction.substring(0, 30));
  return parts.join(' | ');
}
