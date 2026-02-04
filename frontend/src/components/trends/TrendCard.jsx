/**
 * TrendCard Component
 * Displays a single Instagram Reel trend with video player
 */

import { useState, useRef } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  Eye,
  Heart,
  MessageCircle,
  Music,
  ExternalLink,
  Play,
  Pause,
  User,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { clsx } from 'clsx';

function formatCount(num) {
  if (!num) return '0';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return date.toLocaleDateString();
}

export function TrendCard({ trend, onSave, onUnsave, compact = false }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [hasError, setHasError] = useState(false);
  const videoRef = useRef(null);

  const account = trend.account || trend.tracked_accounts;

  const handlePlayClick = () => {
    if (!trend.video_url) {
      // No video URL, open Instagram
      window.open(trend.reel_url, '_blank', 'noopener,noreferrer');
      return;
    }

    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play().catch(() => {
          // If autoplay fails, open Instagram
          window.open(trend.reel_url, '_blank', 'noopener,noreferrer');
        });
        setIsPlaying(true);
      }
    }
  };

  const handleMuteToggle = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleSaveClick = (e) => {
    e.stopPropagation();
    if (trend.is_saved) {
      onUnsave?.(trend.id);
    } else {
      onSave?.(trend.id);
    }
  };

  const handleOpenInstagram = (e) => {
    e.stopPropagation();
    window.open(trend.reel_url, '_blank', 'noopener,noreferrer');
  };

  const handleVideoError = () => {
    setHasError(true);
    setIsPlaying(false);
  };

  return (
    <div className="bg-surface rounded-xl border border-border overflow-hidden hover:border-primary/50 transition-colors">
      {/* Account Header */}
      <div className="flex items-center gap-3 p-3 border-b border-border">
        {account?.profile_pic_url ? (
          <img
            src={account.profile_pic_url}
            alt={account.display_name || account.instagram_handle}
            className="h-10 w-10 rounded-full object-cover"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-text truncate">
            {account?.display_name || account?.instagram_handle}
          </p>
          <p className="text-xs text-text-muted">
            @{account?.instagram_handle}
            {account?.account_type === 'global' && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px] uppercase">
                Global
              </span>
            )}
          </p>
        </div>
        <span className="text-xs text-text-muted">{formatDate(trend.posted_at)}</span>
      </div>

      {/* Video Player / Thumbnail */}
      <div
        className="relative aspect-[9/16] max-h-[500px] bg-black cursor-pointer"
        onClick={handlePlayClick}
      >
        {/* Video element */}
        {trend.video_url && !hasError ? (
          <video
            ref={videoRef}
            src={trend.video_url}
            poster={trend.thumbnail_url}
            className="w-full h-full object-cover"
            loop
            muted={isMuted}
            playsInline
            onError={handleVideoError}
            onEnded={() => setIsPlaying(false)}
          />
        ) : (
          // Fallback to thumbnail or placeholder
          trend.thumbnail_url ? (
            <img
              src={trend.thumbnail_url}
              alt="Reel thumbnail"
              className="w-full h-full object-cover"
              onError={(e) => { e.target.src = ''; e.target.alt = 'Thumbnail unavailable'; }}
            />
          ) : (
            <div className="w-full h-full bg-surface-elevated flex items-center justify-center">
              <Play className="h-12 w-12 text-text-muted" />
            </div>
          )
        )}

        {/* Play/Pause overlay */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors">
            <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
              <Play className="h-8 w-8 text-black fill-current ml-1" />
            </div>
          </div>
        )}

        {/* Controls when playing */}
        {isPlaying && (
          <>
            {/* Tap to pause indicator */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
              <div className="w-16 h-16 rounded-full bg-black/50 flex items-center justify-center">
                <Pause className="h-8 w-8 text-white" />
              </div>
            </div>

            {/* Mute toggle */}
            <button
              onClick={handleMuteToggle}
              className="absolute bottom-3 right-3 p-2 rounded-full bg-black/70 text-white hover:bg-black/90 transition-colors"
            >
              {isMuted ? (
                <VolumeX className="h-5 w-5" />
              ) : (
                <Volume2 className="h-5 w-5" />
              )}
            </button>
          </>
        )}

        {/* Error fallback */}
        {hasError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface-elevated p-4">
            <p className="text-text-muted text-sm mb-3">Video unavailable</p>
            <button
              onClick={handleOpenInstagram}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              View on Instagram
            </button>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4 px-3 py-2 border-t border-border text-sm text-text-muted">
        <div className="flex items-center gap-1" title="Views">
          <Eye className="h-4 w-4" />
          <span>{formatCount(trend.view_count)}</span>
        </div>
        <div className="flex items-center gap-1" title="Likes">
          <Heart className="h-4 w-4" />
          <span>{formatCount(trend.like_count)}</span>
        </div>
        <div className="flex items-center gap-1" title="Comments">
          <MessageCircle className="h-4 w-4" />
          <span>{formatCount(trend.comment_count)}</span>
        </div>
        <div className="flex-1" />
        <button
          onClick={handleSaveClick}
          className={clsx(
            'p-1.5 rounded-lg transition-colors',
            trend.is_saved
              ? 'text-primary bg-primary/10 hover:bg-primary/20'
              : 'text-text-muted hover:text-text hover:bg-surface-elevated'
          )}
          title={trend.is_saved ? 'Remove from saved' : 'Save trend'}
        >
          {trend.is_saved ? (
            <BookmarkCheck className="h-5 w-5" />
          ) : (
            <Bookmark className="h-5 w-5" />
          )}
        </button>
        <button
          onClick={handleOpenInstagram}
          className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-elevated transition-colors"
          title="Open in Instagram"
        >
          <ExternalLink className="h-5 w-5" />
        </button>
      </div>

      {/* Caption Preview */}
      {trend.caption && !compact && (
        <div className="px-3 pb-3">
          <p className="text-sm text-text line-clamp-2">{trend.caption}</p>
        </div>
      )}

      {/* Audio Info */}
      {trend.audio_name && !compact && (
        <div className="px-3 pb-3 flex items-center gap-2 text-xs text-text-muted">
          <Music className="h-3.5 w-3.5" />
          <span className="truncate">{trend.audio_name}</span>
        </div>
      )}

      {/* Notes (for saved trends) */}
      {trend.notes && (
        <div className="px-3 pb-3 pt-1 border-t border-border">
          <p className="text-xs text-text-muted mb-1">Your notes:</p>
          <p className="text-sm text-text">{trend.notes}</p>
        </div>
      )}
    </div>
  );
}
