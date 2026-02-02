/**
 * Gallery Page
 * Unified view of all generated images and videos
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderOpen,
  Download,
  Trash2,
  Heart,
  Filter,
  Image,
  Video,
  RefreshCw,
  Search,
  X,
  Upload,
  Sparkles,
} from 'lucide-react';
import { Layout, PageHeader, Card } from '../components/layout/Layout';
import { Button } from '../components/common/Button';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { SendToMenu } from '../components/common/SendToMenu';
import { useModel } from '../context/ModelContext';
import { api } from '../services/api';

// ============================================================================
// FILTER BAR
// ============================================================================

function FilterBar({ filter, onFilterChange }) {
  const types = [
    { id: 'all', label: 'All', icon: FolderOpen },
    { id: 'image', label: 'Images', icon: Image },
    { id: 'video', label: 'Videos', icon: Video },
  ];

  const sources = [
    { id: 'all', label: 'All' },
    { id: 'generated', label: 'Generated', icon: Sparkles },
    { id: 'upload', label: 'Uploaded', icon: Upload },
  ];

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <div className="flex gap-1 bg-surface rounded-lg border border-border p-1">
        {types.map((t) => (
          <button
            key={t.id}
            onClick={() => onFilterChange({ ...filter, type: t.id })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              filter.type === t.id
                ? 'bg-primary text-white'
                : 'text-text-muted hover:text-text'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex gap-1 bg-surface rounded-lg border border-border p-1">
        {sources.map((s) => (
          <button
            key={s.id}
            onClick={() => onFilterChange({ ...filter, source: s.id })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
              filter.source === s.id
                ? 'bg-primary text-white'
                : 'text-text-muted hover:text-text'
            }`}
          >
            {s.icon && <s.icon className="h-3.5 w-3.5" />}
            {s.label}
          </button>
        ))}
      </div>

      <button
        onClick={() => onFilterChange({ ...filter, favoritesOnly: !filter.favoritesOnly })}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm transition-colors ${
          filter.favoritesOnly
            ? 'border-pink-500 bg-pink-500/10 text-pink-400'
            : 'border-border text-text-muted hover:text-text'
        }`}
      >
        <Heart className={`h-3.5 w-3.5 ${filter.favoritesOnly ? 'fill-current' : ''}`} />
        Favorites
      </button>
    </div>
  );
}

// ============================================================================
// GALLERY ITEM
// ============================================================================

function GalleryItem({ item, onDelete, onToggleFavorite }) {
  const [expanded, setExpanded] = useState(false);
  const isVideo = item.type === 'video';

  const handleDownload = async (e) => {
    e.stopPropagation();
    try {
      const response = await fetch(item.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.title || 'download'}.${isVideo ? 'mp4' : 'png'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  return (
    <>
      <div
        className="group relative bg-surface rounded-xl border border-border overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
        onClick={() => setExpanded(true)}
      >
        {isVideo ? (
          <video
            src={item.url}
            className="w-full aspect-square object-cover"
            preload="metadata"
            muted
          />
        ) : (
          <img
            src={item.url}
            alt={item.title || ''}
            className="w-full aspect-square object-cover"
            loading="lazy"
          />
        )}

        {/* Type badge */}
        <div className="absolute top-2 left-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
            isVideo
              ? 'bg-blue-500/80 text-white'
              : 'bg-green-500/80 text-white'
          }`}>
            {isVideo ? 'Video' : 'Image'}
          </span>
        </div>

        {/* Bottom-right action bar */}
        <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavorite(item.id); }}
            className={`p-1.5 rounded-full transition-colors ${
              item.is_favorited
                ? 'bg-pink-500 text-white'
                : 'bg-black/70 text-white hover:bg-black/90'
            }`}
            title="Favorite"
          >
            <Heart className={`h-3.5 w-3.5 ${item.is_favorited ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded-full bg-black/70 text-white hover:bg-black/90 transition-colors"
            title="Download"
          >
            <Download className="h-3.5 w-3.5" />
          </button>
          {!isVideo && <SendToMenu imageUrl={item.url} />}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
            className="p-1.5 rounded-full bg-black/70 text-red-400 hover:bg-black/90 transition-colors"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Bottom gradient with tags */}
        {item.tags?.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <p className="text-white text-xs truncate">{item.tags.join(', ')}</p>
          </div>
        )}
      </div>

      {/* Expanded Modal */}
      {expanded && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setExpanded(false)}
        >
          <div
            className="bg-surface rounded-xl border border-border max-w-4xl max-h-[90vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-text truncate">{item.title}</h3>
                <button
                  onClick={() => setExpanded(false)}
                  className="p-2 rounded-lg hover:bg-surface-elevated transition-colors"
                >
                  <X className="h-5 w-5 text-text-muted" />
                </button>
              </div>
              {isVideo ? (
                <video src={item.url} controls className="w-full rounded-lg" />
              ) : (
                <img src={item.url} alt={item.title || ''} className="w-full rounded-lg" />
              )}
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                {item.tags?.map((tag, i) => (
                  <span key={i} className="px-2 py-1 rounded-full bg-surface-elevated text-xs text-text-muted">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={handleDownload}>
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                {!isVideo && <SendToMenu imageUrl={item.url} className="inline-flex" />}
                <Button
                  size="sm"
                  variant={item.is_favorited ? 'danger' : 'outline'}
                  onClick={() => onToggleFavorite(item.id)}
                >
                  <Heart className={`h-4 w-4 mr-1 ${item.is_favorited ? 'fill-current' : ''}`} />
                  {item.is_favorited ? 'Unfavorite' : 'Favorite'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-red-400"
                  onClick={() => { onDelete(item.id); setExpanded(false); }}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export function GalleryPage() {
  const { selectedModel } = useModel();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [filter, setFilter] = useState({ type: 'all', source: 'all', favoritesOnly: false });
  const fileInputRef = useRef(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (filter.type !== 'all') params.type = filter.type;
      if (filter.source !== 'all') params.source = filter.source;
      if (filter.favoritesOnly) params.favorites = true;
      if (selectedModel?.id) params.model_id = selectedModel.id;
      const data = await api.getGallery(params);
      setItems(data.items || []);
    } catch (err) {
      console.error('Failed to fetch gallery:', err);
    } finally {
      setLoading(false);
    }
  }, [filter, selectedModel?.id]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleDelete = async (id) => {
    try {
      await api.deleteGalleryItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  const handleToggleFavorite = async (id) => {
    try {
      await api.toggleFavorite(id);
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, is_favorited: !item.is_favorited } : item
        )
      );
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      // Convert files to base64 data URIs
      const images = await Promise.all(
        files.map(
          (file) =>
            new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            })
        )
      );

      await api.uploadToGallery({
        model_id: selectedModel?.id || null,
        images,
      });

      await fetchItems();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const counts = {
    total: items.length,
    images: items.filter((i) => i.type === 'image').length,
    videos: items.filter((i) => i.type === 'video').length,
  };

  return (
    <Layout>
      <PageHeader
        title={selectedModel ? `${selectedModel.name}'s Gallery` : 'Gallery'}
        description={selectedModel ? `Content for ${selectedModel.name}` : 'Select a model to view their content'}
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !selectedModel}
              title={!selectedModel ? 'Select a model first' : 'Upload reference images'}
            >
              <Upload className="h-4 w-4 mr-1" />
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
            <Button variant="ghost" size="sm" onClick={fetchItems}>
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        }
      />

      <div className="space-y-4">
        {/* Filters */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <FilterBar filter={filter} onFilterChange={setFilter} />
          <p className="text-sm text-text-muted">
            {counts.total} items ({counts.images} images, {counts.videos} videos)
          </p>
        </div>

        {/* Grid */}
        {loading ? (
          <Card>
            <LoadingSpinner label="Loading gallery..." showTimer={false} />
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <FolderOpen className="h-16 w-16 text-text-muted mb-4" />
              <h3 className="text-lg font-semibold text-text mb-2">No content yet</h3>
              <p className="text-text-muted max-w-md">
                {filter.favoritesOnly
                  ? 'No favorites yet. Heart items from the gallery to save them here.'
                  : 'Generate images or videos to see them here.'}
              </p>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {items.map((item) => (
              <GalleryItem
                key={item.id}
                item={item}
                onDelete={handleDelete}
                onToggleFavorite={handleToggleFavorite}
              />
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
