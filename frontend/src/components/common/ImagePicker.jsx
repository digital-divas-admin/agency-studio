/**
 * ImagePicker Component
 * Modal for browsing a model's gallery to select an image as input.
 * Used in EditTools (img2img, inpainting source) and ImageGen (Seedream img2img).
 */

import { useState, useEffect, useCallback } from 'react';
import { X, FolderOpen, Loader2, Image as ImageIcon } from 'lucide-react';
import { useModel } from '../../context/ModelContext';
import { api } from '../../services/api';

async function imageUrlToDataUrl(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function PickerModal({ onSelect, onClose }) {
  const { selectedModel } = useModel();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [converting, setConverting] = useState(null);

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      try {
        const params = { type: 'image', limit: 100 };
        if (selectedModel?.id) params.model_id = selectedModel.id;
        const data = await api.getGallery(params);
        setItems(data.items || []);
      } catch (err) {
        console.error('Failed to fetch gallery for picker:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [selectedModel?.id]);

  const handleSelect = async (item) => {
    setConverting(item.id);
    try {
      const dataUrl = await imageUrlToDataUrl(item.url);
      onSelect(dataUrl);
      onClose();
    } catch (err) {
      console.error('Failed to load image:', err);
    } finally {
      setConverting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-xl border border-border w-full max-w-3xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border flex-shrink-0">
          <h2 className="text-lg font-bold text-text">
            {selectedModel ? `${selectedModel.name}'s Gallery` : 'Gallery'}
          </h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-elevated transition-colors">
            <X className="h-5 w-5 text-text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FolderOpen className="h-12 w-12 text-text-muted mb-3" />
              <p className="text-text-muted">
                {selectedModel
                  ? `No images in ${selectedModel.name}'s gallery yet.`
                  : 'No images available. Select a model first.'}
              </p>
              <p className="text-xs text-text-muted mt-1">
                Upload images or generate content to see them here.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleSelect(item)}
                  disabled={converting !== null}
                  className="relative group rounded-lg overflow-hidden border border-border hover:border-primary transition-colors aspect-square"
                >
                  <img
                    src={item.url}
                    alt={item.title || ''}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {converting === item.id && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Loader2 className="h-6 w-6 text-white animate-spin" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/20 transition-colors" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ImagePicker({ onSelect, className = '' }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-text-muted hover:text-text hover:border-primary transition-colors ${className}`}
      >
        <ImageIcon className="h-4 w-4" />
        Browse Gallery
      </button>

      {open && (
        <PickerModal
          onSelect={onSelect}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
