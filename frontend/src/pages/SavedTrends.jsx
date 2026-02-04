/**
 * SavedTrends Page
 * View and manage bookmarked trends
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Bookmark,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Edit3,
  Save,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Layout, PageHeader, Card } from '../components/layout/Layout';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { TrendCard } from '../components/trends/TrendCard';
import { api } from '../services/api';

const ITEMS_PER_PAGE = 12;

function NotesEditor({ savedId, initialNotes, onSave, onCancel }) {
  const [notes, setNotes] = useState(initialNotes || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(savedId, notes);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Add notes about this trend..."
        className="w-full px-3 py-2 bg-surface border border-border rounded-lg text-text placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary resize-none"
        rows={3}
      />
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4 mr-1" />
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-1" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}

function SavedTrendCard({ trend, onUpdateNotes, onRemove }) {
  const [editing, setEditing] = useState(false);

  const handleSaveNotes = async (savedId, notes) => {
    await onUpdateNotes(savedId, notes);
    setEditing(false);
  };

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden">
      <TrendCard
        trend={{ ...trend, is_saved: true }}
        onUnsave={() => onRemove(trend.saved_id)}
        compact
      />

      {/* Notes Section */}
      <div className="p-3 border-t border-border">
        {editing ? (
          <NotesEditor
            savedId={trend.saved_id}
            initialNotes={trend.notes}
            onSave={handleSaveNotes}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {trend.notes ? (
                <p className="text-sm text-text">{trend.notes}</p>
              ) : (
                <p className="text-sm text-text-muted italic">No notes</p>
              )}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => setEditing(true)}
                className="p-1.5 text-text-muted hover:text-text hover:bg-surface-elevated rounded transition-colors"
                title="Edit notes"
              >
                <Edit3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => onRemove(trend.saved_id)}
                className="p-1.5 text-text-muted hover:text-red-400 hover:bg-red-500/10 rounded transition-colors"
                title="Remove from saved"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        <p className="text-xs text-text-muted mt-2">
          Saved {new Date(trend.saved_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

export function SavedTrendsPage() {
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const fetchSavedTrends = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getSavedTrends({
        limit: ITEMS_PER_PAGE,
        offset: page * ITEMS_PER_PAGE,
      });
      setTrends(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch saved trends:', err);
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchSavedTrends();
  }, [fetchSavedTrends]);

  const handleUpdateNotes = async (savedId, notes) => {
    try {
      await api.updateSavedTrendNotes(savedId, notes);
      setTrends((prev) =>
        prev.map((t) => (t.saved_id === savedId ? { ...t, notes } : t))
      );
    } catch (err) {
      console.error('Failed to update notes:', err);
      throw err;
    }
  };

  const handleRemove = async (savedId) => {
    try {
      await api.removeSavedTrend(savedId);
      setTrends((prev) => prev.filter((t) => t.saved_id !== savedId));
      setTotal((prev) => prev - 1);
    } catch (err) {
      console.error('Failed to remove saved trend:', err);
    }
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <Layout>
      <PageHeader
        title="Saved Trends"
        description="Your bookmarked trends for content inspiration"
        actions={
          <div className="flex gap-2">
            <Link to="/trends">
              <Button variant="ghost" size="sm">
                <ChevronLeft className="h-4 w-4 mr-1" />
                Back to Feed
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={fetchSavedTrends}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        <p className="text-sm text-text-muted">{total} saved trends</p>

        {loading ? (
          <Card>
            <LoadingSpinner label="Loading saved trends..." showTimer={false} />
          </Card>
        ) : trends.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Bookmark className="h-16 w-16 text-text-muted mb-4" />
              <h3 className="text-lg font-semibold text-text mb-2">No saved trends</h3>
              <p className="text-text-muted max-w-md mb-4">
                Save trends from the feed to keep track of content ideas and inspiration.
              </p>
              <Link to="/trends">
                <Button>Browse Trends</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <>
            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {trends.map((trend) => (
                <SavedTrendCard
                  key={trend.saved_id}
                  trend={trend}
                  onUpdateNotes={handleUpdateNotes}
                  onRemove={handleRemove}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-4 pt-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-text-muted">
                  Page {page + 1} of {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
