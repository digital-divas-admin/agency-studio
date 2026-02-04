/**
 * Trends Page
 * Instagram Reels trends discovery feed
 */

import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  RefreshCw,
  Bookmark,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Layout, PageHeader, Card } from '../components/layout/Layout';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { TrendCard } from '../components/trends/TrendCard';
import { TrendsFilters } from '../components/trends/TrendsFilters';
import { TrackedAccountsList } from '../components/trends/TrackedAccountsList';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

const ITEMS_PER_PAGE = 12;

export function TrendsPage() {
  const { isAdmin } = useAuth();
  const [trends, setTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState('all');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  // Settings state
  const [accounts, setAccounts] = useState({ global: [], workspace: [], workspaceLimit: 20 });
  const [accountsLoading, setAccountsLoading] = useState(false);

  const fetchTrends = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getTrends({
        limit: ITEMS_PER_PAGE,
        offset: page * ITEMS_PER_PAGE,
        source,
      });
      setTrends(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      console.error('Failed to fetch trends:', err);
    } finally {
      setLoading(false);
    }
  }, [source, page]);

  const fetchAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const data = await api.getTrendAccounts();
      setAccounts(data);
    } catch (err) {
      console.error('Failed to fetch accounts:', err);
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrends();
  }, [fetchTrends]);

  useEffect(() => {
    if (showSettings) {
      fetchAccounts();
    }
  }, [showSettings, fetchAccounts]);

  // Reset to page 0 when filter changes
  useEffect(() => {
    setPage(0);
  }, [source]);

  const handleSave = async (trendId) => {
    try {
      await api.saveTrend(trendId);
      setTrends((prev) =>
        prev.map((t) => (t.id === trendId ? { ...t, is_saved: true } : t))
      );
    } catch (err) {
      console.error('Failed to save trend:', err);
    }
  };

  const handleUnsave = async (trendId) => {
    try {
      await api.unsaveTrend(trendId);
      setTrends((prev) =>
        prev.map((t) => (t.id === trendId ? { ...t, is_saved: false } : t))
      );
    } catch (err) {
      console.error('Failed to unsave trend:', err);
    }
  };

  const handleAddAccount = async (handle) => {
    await api.addTrendAccount({ instagram_handle: handle });
    await fetchAccounts();
  };

  const handleRemoveAccount = async (id) => {
    await api.removeTrendAccount(id);
    await fetchAccounts();
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  // Settings view
  if (showSettings) {
    return (
      <Layout>
        <PageHeader
          title="Tracked Accounts"
          description="Manage Instagram accounts to monitor for trending content"
          actions={
            <Button variant="ghost" onClick={() => setShowSettings(false)}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back to Trends
            </Button>
          }
        />

        <Card>
          <TrackedAccountsList
            globalAccounts={accounts.global}
            workspaceAccounts={accounts.workspace}
            workspaceLimit={accounts.workspaceLimit}
            loading={accountsLoading}
            onAdd={handleAddAccount}
            onRemove={handleRemoveAccount}
            isAdmin={isAdmin}
          />
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <PageHeader
        title="Trends"
        description="Discover trending Instagram Reels for content inspiration"
        actions={
          <div className="flex gap-2">
            <Link to="/trends/saved">
              <Button variant="ghost" size="sm">
                <Bookmark className="h-4 w-4 mr-1" />
                Saved
              </Button>
            </Link>
            {isAdmin && (
              <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
                <Settings className="h-4 w-4 mr-1" />
                Accounts
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={fetchTrends}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
        {/* Filters */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <TrendsFilters source={source} onSourceChange={setSource} />
          <p className="text-sm text-text-muted">
            {total} trends found
          </p>
        </div>

        {/* Content */}
        {loading ? (
          <Card>
            <LoadingSpinner label="Loading trends..." showTimer={false} />
          </Card>
        ) : trends.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <TrendingUp className="h-16 w-16 text-text-muted mb-4" />
              <h3 className="text-lg font-semibold text-text mb-2">No trends yet</h3>
              <p className="text-text-muted max-w-md mb-4">
                {source === 'workspace'
                  ? 'No workspace accounts are being tracked. Add some Instagram handles to get started.'
                  : 'Trends will appear here once Instagram accounts are being tracked and scraped.'}
              </p>
              {isAdmin && source === 'workspace' && (
                <Button onClick={() => setShowSettings(true)}>
                  <Settings className="h-4 w-4 mr-1" />
                  Add Accounts
                </Button>
              )}
            </div>
          </Card>
        ) : (
          <>
            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {trends.map((trend) => (
                <TrendCard
                  key={trend.id}
                  trend={trend}
                  onSave={handleSave}
                  onUnsave={handleUnsave}
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
