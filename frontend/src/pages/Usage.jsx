/**
 * Usage Statistics Page (Admin only)
 * Credit usage analytics for the current billing cycle
 */

import { useState, useEffect } from 'react';
import { BarChart3, Zap, TrendingUp, Users } from 'lucide-react';
import { Layout, PageHeader, Card } from '../components/layout/Layout';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';

// ============================================================================
// STAT CARD
// ============================================================================

function StatCard({ icon: Icon, label, value, subtext, color = 'primary' }) {
  const colors = {
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-blue-500/10 text-blue-500',
    orange: 'bg-orange-500/10 text-orange-500',
    green: 'bg-green-500/10 text-green-500',
  };

  return (
    <Card className="flex items-center gap-4">
      <div className={`p-3 rounded-lg ${colors[color]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm text-text-muted">{label}</p>
        <p className="text-2xl font-bold text-text">{value}</p>
        {subtext && <p className="text-xs text-text-muted mt-0.5">{subtext}</p>}
      </div>
    </Card>
  );
}

// ============================================================================
// USAGE BAR
// ============================================================================

function UsageBar({ label, value, max, color = 'bg-primary' }) {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-text">{label}</span>
        <span className="text-text-muted">{value.toLocaleString()}</span>
      </div>
      <div className="w-full h-2 bg-surface-elevated rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export function UsagePage() {
  const { credits } = useAuth();
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsage() {
      try {
        const data = await api.getUsage();
        setUsage(data);
      } catch (err) {
        console.error('Failed to fetch usage:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchUsage();
  }, []);

  if (loading) {
    return (
      <Layout>
        <PageHeader title="Usage Statistics" description="Credit usage and analytics" />
        <Card>
          <LoadingSpinner label="Loading usage data..." showTimer={false} />
        </Card>
      </Layout>
    );
  }

  const totalUsed = credits?.agencyUsedThisCycle || 0;
  const totalPool = credits?.agencyPool || 0;
  const totalAvailable = totalUsed + totalPool;

  // Model usage breakdown from usage API
  // Backend returns usage.byModel as an object { modelName: credits }, convert to array
  const byModelObj = usage?.usage?.byModel || {};
  const modelBreakdown = Object.entries(byModelObj).map(([model, credits]) => ({ model, credits }));
  const maxModelUsage = Math.max(...modelBreakdown.map((m) => m.credits || 0), 1);

  // Per-user breakdown — backend returns top-level `users` array
  const userBreakdown = usage?.users || [];
  const maxUserUsage = Math.max(...userBreakdown.map((u) => u.credits_used_this_cycle || 0), 1);

  return (
    <Layout>
      <PageHeader
        title="Usage Statistics"
        description="Credit usage and analytics for the current billing cycle"
      />

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          icon={Zap}
          label="Credits Used This Cycle"
          value={totalUsed.toLocaleString()}
          color="primary"
        />
        <StatCard
          icon={TrendingUp}
          label="Credits Remaining"
          value={totalPool.toLocaleString()}
          subtext={totalAvailable > 0 ? `${Math.round((totalUsed / totalAvailable) * 100)}% used` : undefined}
          color="green"
        />
        <StatCard
          icon={Users}
          label="Active Users"
          value={userBreakdown.length}
          color="secondary"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage by Model */}
        <Card>
          <h3 className="font-semibold text-text mb-4">Usage by Model</h3>
          {modelBreakdown.length > 0 ? (
            <div className="space-y-3">
              {modelBreakdown.map((item) => (
                <UsageBar
                  key={item.model}
                  label={item.model}
                  value={item.credits}
                  max={maxModelUsage}
                  color="bg-primary"
                />
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-sm py-4 text-center">No usage data yet</p>
          )}
        </Card>

        {/* Usage by User */}
        <Card>
          <h3 className="font-semibold text-text mb-4">Usage by User</h3>
          {userBreakdown.length > 0 ? (
            <div className="space-y-3">
              {userBreakdown.map((item) => (
                <UsageBar
                  key={item.name || item.email}
                  label={item.name || item.email}
                  value={item.credits_used_this_cycle || 0}
                  max={maxUserUsage}
                  color="bg-blue-500"
                />
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-sm py-4 text-center">No usage data yet</p>
          )}
        </Card>
      </div>

      {/* Generation Count */}
      {usage?.usage?.totalGenerations !== undefined && (
        <Card className="mt-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-text">Total Generations</h3>
              <p className="text-sm text-text-muted">All content generated this cycle</p>
            </div>
            <p className="text-3xl font-bold text-text">
              {(usage.usage.totalGenerations || 0).toLocaleString()}
            </p>
          </div>
        </Card>
      )}
    </Layout>
  );
}
