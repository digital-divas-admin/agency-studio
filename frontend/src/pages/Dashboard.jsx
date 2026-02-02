/**
 * Dashboard Page
 * Model-centric dashboard with stats, alerts, and recent activity
 */

import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Zap,
  Image,
  Video,
  GitBranch,
  CalendarClock,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2,
  Play,
  ArrowRight,
  User,
  Plus,
  Activity,
  Clock,
  Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
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

function timeUntil(dateStr) {
  if (!dateStr) return '';
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return 'overdue';
  if (diff < 60000) return '<1 min';
  if (diff < 3600000) return `${Math.round(diff / 60000)} min`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

const RUN_STATUS = {
  running:            { icon: Loader2, color: 'text-blue-400', label: 'Running', animate: true },
  waiting_for_review: { icon: Eye, color: 'text-yellow-400', label: 'Needs Review' },
  completed:          { icon: CheckCircle, color: 'text-green-400', label: 'Completed' },
  failed:             { icon: XCircle, color: 'text-red-400', label: 'Failed' },
  cancelled:          { icon: XCircle, color: 'text-gray-400', label: 'Cancelled' },
};

// =============================================
// Model Card
// =============================================

function ModelCard({ model, onSelect, onSelectOnly }) {
  const hasReviews = model.pending_reviews > 0;

  return (
    <div className="w-full max-w-[240px] h-[220px] card-premium p-4 group flex flex-col">
      {/* Clickable card body — selects model and navigates to generate */}
      <div
        onClick={() => onSelect(model)}
        className="cursor-pointer flex flex-col flex-1"
      >
        <div className="flex items-center gap-3 mb-3">
          {model.avatar_url ? (
            <img
              src={model.avatar_url}
              alt={model.name}
              className="h-14 w-14 rounded-full object-cover border-2 border-border group-hover:border-primary/50 transition-colors"
            />
          ) : (
            <div className="h-14 w-14 rounded-full bg-purple-500/20 flex items-center justify-center border-2 border-border group-hover:border-primary/50 transition-colors">
              <User className="h-7 w-7 text-purple-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-text truncate">{model.name}</h3>
            {model.onlyfans_handle && (
              <p className="text-sm text-text-muted truncate">{model.onlyfans_handle}</p>
            )}
          </div>
          {hasReviews && (
            <span className="flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">
              <Eye className="h-3.5 w-3.5" />
              {model.pending_reviews}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted h-[40px] content-start">
          <span className="flex items-center gap-1.5">
            <Image className="h-3.5 w-3.5" />
            {model.gallery_count} images
          </span>
          <span className="flex items-center gap-1.5">
            <GitBranch className="h-3.5 w-3.5" />
            {model.workflow_count} workflows
          </span>
          {model.active_schedules > 0 && (
            <span className="flex items-center gap-1.5 text-green-400">
              <CalendarClock className="h-3.5 w-3.5" />
              {model.active_schedules} scheduled
            </span>
          )}
        </div>
      </div>

      {/* Action buttons — separate from the card click target */}
      <div className="flex flex-col gap-1.5 mt-4">
        <Link
          to="/generate/image"
          onClick={() => onSelectOnly(model)}
        >
          <button className="w-full py-2 px-3 bg-gradient-primary text-white text-sm font-semibold rounded-lg hover:shadow-glow-lg hover:scale-105 active:scale-95 transition-all">
            Generate
          </button>
        </Link>
        <div className="flex gap-1.5">
          <Link
            to="/workflows"
            onClick={() => onSelectOnly(model)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-surface text-text-muted rounded-lg text-xs font-medium hover:bg-surface-elevated hover:text-text transition-colors border border-border"
          >
            <GitBranch className="h-3.5 w-3.5" /> Workflows
          </Link>
          <Link
            to="/gallery"
            onClick={() => onSelectOnly(model)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-surface text-text-muted rounded-lg text-xs font-medium hover:bg-surface-elevated hover:text-text transition-colors border border-border"
          >
            <Image className="h-3.5 w-3.5" /> Gallery
          </Link>
        </div>
      </div>
    </div>
  );
}

// =============================================
// Alert Banners
// =============================================

function AlertBanners({ pendingReviews, recentFailures, navigate }) {
  if (pendingReviews.length === 0 && recentFailures.length === 0) return null;

  return (
    <div className="space-y-2 mb-6">
      {pendingReviews.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg shadow-[0_0_20px_rgba(234,179,8,0.2)] animate-slide-up">
          <Eye className="h-4 w-4 text-yellow-400 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-medium text-yellow-400">{pendingReviews.length} workflow{pendingReviews.length !== 1 ? 's' : ''} waiting for review</span>
            <span className="text-text-muted ml-2">
              {pendingReviews.slice(0, 3).map((r) => r.workflow_name).join(', ')}
              {pendingReviews.length > 3 ? ` +${pendingReviews.length - 3} more` : ''}
            </span>
          </div>
          <button
            onClick={() => navigate(`/workflows/${pendingReviews[0].workflow_id}/runs/${pendingReviews[0].id}`)}
            className="text-xs text-yellow-400 hover:text-yellow-300 font-medium flex items-center gap-1"
          >
            Review <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {recentFailures.length > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg shadow-[0_0_20px_rgba(239,68,68,0.2)] animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
          <div className="flex-1 text-sm">
            <span className="font-medium text-red-400">{recentFailures.length} failed run{recentFailures.length !== 1 ? 's' : ''} today</span>
            <span className="text-text-muted ml-2">
              {recentFailures.slice(0, 3).map((r) => r.workflow_name).join(', ')}
            </span>
          </div>
          <button
            onClick={() => navigate(`/workflows/${recentFailures[0].workflow_id}/runs/${recentFailures[0].id}`)}
            className="text-xs text-red-400 hover:text-red-300 font-medium flex items-center gap-1"
          >
            View <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// =============================================
// Recent Gallery
// =============================================

function RecentGallery({ items }) {
  if (items.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-text">Recent Generations</h2>
        <Link to="/gallery" className="text-xs text-primary hover:text-primary-hover flex items-center gap-1">
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {items.slice(0, 6).map((item, index) => {
          // Prefer lightweight thumbnail; fall back to full url for older items
          const imgSrc = item.thumbnail_url || item.url;
          return (
            <div
              key={item.id}
              className="stagger-item aspect-square rounded-lg overflow-hidden border-2 border-border bg-surface-elevated hover:border-primary/50 hover:shadow-glow hover:-translate-y-1 transition-all duration-200 group cursor-pointer relative"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {item.type === 'video' || !imgSrc ? (
                <div className="w-full h-full flex items-center justify-center bg-surface">
                  {item.type === 'video'
                    ? <Video className="h-6 w-6 text-text-muted" />
                    : <Image className="h-6 w-6 text-text-muted" />}
                </div>
              ) : (
                <>
                  <img
                    src={imgSrc}
                    alt={item.title || ''}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-200"
                    loading="lazy"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      e.target.parentElement.classList.add('flex', 'items-center', 'justify-center');
                      const icon = document.createElement('div');
                      icon.className = 'text-text-muted text-xs';
                      icon.textContent = item.title || 'Image';
                      e.target.parentElement.appendChild(icon);
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================
// Recent Runs
// =============================================

function RecentRuns({ runs, navigate }) {
  if (runs.length === 0) return null;

  return (
    <>
      <h2 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
        <Activity className="h-5 w-5 text-primary" />
        Recent Runs
      </h2>
      <div className="bg-surface-elevated border border-border rounded-xl overflow-hidden divide-y divide-border">
        {runs.slice(0, 6).map((run) => {
          const style = RUN_STATUS[run.status] || RUN_STATUS.cancelled;
          const Icon = style.icon;
          return (
            <button
              key={run.id}
              onClick={() => navigate(`/workflows/${run.workflow_id}/runs/${run.id}`)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-primary/5 transition-colors text-left"
            >
              <Icon className={`h-4 w-4 flex-shrink-0 ${style.color} ${style.animate ? 'animate-spin' : ''}`} />
              <div className="flex-1 min-w-0">
                <span className="text-sm text-text font-medium">{run.workflow_name}</span>
                {run.model_name && (
                  <span className="text-xs text-text-muted ml-2">{run.model_name}</span>
                )}
              </div>
              <span className={`text-xs font-medium ${style.color}`}>{style.label}</span>
              <span className="text-[10px] text-text-muted w-16 text-right">{timeAgo(run.started_at)}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

// =============================================
// Upcoming Schedules
// =============================================

function UpcomingSchedules({ triggers }) {
  if (triggers.length === 0) return null;

  return (
    <>
      <h2 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
        <Clock className="h-5 w-5 text-primary" />
        Upcoming
      </h2>
      <div className="bg-surface-elevated border border-border rounded-xl overflow-hidden divide-y divide-border">
        {triggers.map((t) => (
          <div key={t.id} className="flex items-center gap-3 px-4 py-3">
            <CalendarClock className="h-4 w-4 text-green-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-sm text-text font-medium">{t.workflow_name}</span>
              {t.model_name && (
                <span className="text-xs text-text-muted ml-2">{t.model_name}</span>
              )}
            </div>
            <span className="text-xs text-green-400 font-medium">in {timeUntil(t.next_trigger_at)}</span>
          </div>
        ))}
      </div>
    </>
  );
}

// =============================================
// Main Dashboard
// =============================================

export function DashboardPage() {
  const { agencyUser } = useAuth();
  const { selectModel } = useModel();
  const navigate = useNavigate();

  const { data, isLoading: loading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.getDashboard(),
    staleTime: 0, // Always refetch in background on mount, but show cached data instantly
  });

  const handleSelectModel = (model) => {
    selectModel(model.id);
    navigate('/generate/image');
  };

  // Used by quick action Links — only select model, Link handles navigation
  const handleSelectModelOnly = (model) => {
    selectModel(model.id);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-primary/10 animate-float">
            <div className="w-12 h-12 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
              <Loader2 className="h-6 w-6 text-white animate-spin-slow" />
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  const credits = data?.credits;
  const models = data?.models || [];
  const recentGallery = data?.recent_gallery || [];
  const recentRuns = data?.recent_runs || [];
  const pendingReviews = data?.pending_reviews || [];
  const recentFailures = data?.recent_failures || [];
  const upcomingTriggers = data?.upcoming_triggers || [];

  return (
    <Layout>
      <div className="space-y-6 animate-fade-in">
          {/* Header + Credits bar */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-text mb-2">
                Welcome back, <span className="text-transparent bg-clip-text bg-gradient-primary">{agencyUser?.name || 'User'}</span>
              </h1>
              <p className="text-text-muted">
                {models.length > 0
                  ? `Managing ${models.length} model${models.length !== 1 ? 's' : ''}`
                  : 'Get started by adding your first model'}
              </p>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-3 px-4 py-3 bg-gradient-primary/10 border border-primary/30 rounded-xl shadow-glow">
                <Zap className="h-5 w-5 text-primary" />
                <div>
                  <div className="text-lg font-bold text-text">{credits?.agencyPool?.toLocaleString() || 0}</div>
                  <div className="text-xs text-text-muted">credits available</div>
                </div>
              </div>
              {credits?.agencyUsedThisCycle > 0 && (
                <span className="text-xs text-text-muted">
                  {credits.agencyUsedThisCycle.toLocaleString()} used this month
                </span>
              )}
            </div>
          </div>

          {/* Alert banners */}
          <AlertBanners
            pendingReviews={pendingReviews}
            recentFailures={recentFailures}
            navigate={navigate}
          />

          {/* Model Cards */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text">Your Models</h2>
              <Link
                to="/models"
                className="text-xs text-primary hover:text-primary-hover flex items-center gap-1"
              >
                <Plus className="h-3 w-3" /> Add Model
              </Link>
            </div>

            {models.length === 0 ? (
              <div className="card-premium text-center py-16 animate-fade-in">
                {/* Animated Icon Container */}
                <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-primary/10 mb-6 animate-float">
                  <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
                    <User className="h-10 w-10 text-white" />
                  </div>
                </div>

                {/* Heading with Gradient */}
                <h3 className="text-2xl font-bold text-text mb-3">
                  Ready to <span className="text-transparent bg-clip-text bg-gradient-primary">Get Started</span>?
                </h3>

                {/* Description */}
                <p className="text-text-muted max-w-md mx-auto mb-6 leading-relaxed">
                  Add your first creator model to unlock image generation, workflows, and automated content creation.
                </p>

                {/* CTA Button */}
                <Link to="/models">
                  <button className="btn-gradient inline-flex items-center gap-2">
                    <Plus className="h-5 w-5" />
                    Add Your First Model
                  </button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {models.map((model, index) => (
                  <div key={model.id} className="stagger-item" style={{ animationDelay: `${index * 0.05}s` }}>
                    <ModelCard
                      model={model}
                      onSelect={handleSelectModel}
                      onSelectOnly={handleSelectModelOnly}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Gallery — full width */}
          <RecentGallery items={recentGallery} />

          {/* Activity — runs and schedules side-by-side, today stats inline */}
          {(recentRuns.length > 0 || upcomingTriggers.length > 0) && (
            <div className={`grid grid-cols-1 gap-6 mb-6 ${
              recentRuns.length > 0 && upcomingTriggers.length > 0 ? 'lg:grid-cols-2' : ''
            }`}>
              {/* Recent Runs */}
              {recentRuns.length > 0 && (
                <div className="card-premium p-6 animate-slide-up">
                  <RecentRuns runs={recentRuns} navigate={navigate} />
                  {/* Today stats — inline below runs */}
                  {(() => {
                    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
                    const todayRuns = recentRuns.filter((r) => new Date(r.started_at) >= todayStart);
                    const todayCompleted = todayRuns.filter((r) => r.status === 'completed').length;
                    const todayCredits = todayRuns.reduce((sum, r) => sum + (r.credits_used || 0), 0);
                    if (todayRuns.length === 0) return null;
                    return (
                      <div className="flex items-center gap-2 mt-4 flex-wrap">
                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface rounded-lg border border-border">
                          <Activity className="h-3.5 w-3.5 text-primary" />
                          <span className="text-xs text-text-muted">Today:</span>
                          <span className="text-xs font-semibold text-text">{todayRuns.length}</span>
                        </div>

                        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-green-500/10 rounded-lg border border-green-500/30">
                          <Check className="h-3.5 w-3.5 text-green-400" />
                          <span className="text-xs font-semibold text-green-400">{todayCompleted}</span>
                        </div>

                        {todayCredits > 0 && (
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary/10 rounded-lg border border-primary/30">
                            <Zap className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-semibold text-text">{todayCredits}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Upcoming Schedules */}
              {upcomingTriggers.length > 0 && (
                <div className="card-premium p-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
                  <UpcomingSchedules triggers={upcomingTriggers} />
                </div>
              )}
            </div>
          )}
      </div>
    </Layout>
  );
}
