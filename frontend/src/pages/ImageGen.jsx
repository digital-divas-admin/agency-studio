/**
 * Image Generation Page
 * Generate images with Seedream, Nano Banana Pro, and Qwen
 */

import { useState, useEffect, useCallback } from 'react';
import { Image, Loader2, Download, Zap, Trash2, RefreshCw, ChevronDown, Sparkles, Check, X, ArrowRight } from 'lucide-react';
import { Layout, PageHeader, Card } from '../components/layout/Layout';
import { Button } from '../components/common/Button';
import { SendToMenu } from '../components/common/SendToMenu';
import { useAuth } from '../context/AuthContext';
import { useModel } from '../context/ModelContext';

const MODELS = [
  { id: 'seedream', name: 'Seedream 4.5', credits: 10 },
  { id: 'nano-banana', name: 'Nano Banana Pro', credits: 8 },
  { id: 'qwen', name: 'Qwen Image', credits: 5 },
];

const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1 Square', width: 2048, height: 2048, qwenWidth: 1152, qwenHeight: 1152 },
  { id: '16:9', label: '16:9 Landscape', width: 2560, height: 1440, qwenWidth: 1536, qwenHeight: 864 },
  { id: '9:16', label: '9:16 Portrait', width: 1440, height: 2560, qwenWidth: 864, qwenHeight: 1536 },
  { id: '4:3', label: '4:3 Standard', width: 2240, height: 1680, qwenWidth: 1536, qwenHeight: 1152 },
];

function getAuthToken() {
  try {
    const tokenData = localStorage.getItem('supabase.auth.token');
    if (tokenData) {
      return JSON.parse(tokenData).access_token;
    }
  } catch {}
  return '';
}

// ============================================================================
// SUCCESS TOAST
// ============================================================================

function SuccessToast({ show, onClose }) {
  if (!show) return null;

  return (
    <div className="fixed top-6 right-6 z-50 animate-slide-up">
      <div className="bg-green-500 text-white px-6 py-4 rounded-xl shadow-glow-lg flex items-center gap-3">
        <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center animate-scale-in">
          <Check className="h-5 w-5" />
        </div>
        <div>
          <p className="font-semibold">Success!</p>
          <p className="text-sm text-green-100">Your images are ready</p>
        </div>
        <button
          onClick={onClose}
          className="ml-4 hover:bg-white/20 p-1 rounded transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// STYLED DROPDOWN
// ============================================================================

function Dropdown({ label, value, onChange, options, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-text-muted mb-1.5">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-surface-elevated border border-border rounded-lg px-3 py-2.5 pr-9 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary hover:border-primary/30 transition-all duration-200 cursor-pointer"
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export function ImageGenPage() {
  const { credits, refreshCredits } = useAuth();
  const { selectedModel: activeModel } = useModel();
  const [model, setModel] = useState('seedream');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [numOutputs, setNumOutputs] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [error, setError] = useState('');
  const [images, setImages] = useState([]);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loadingElapsed, setLoadingElapsed] = useState(0);

  const selectedModel = MODELS.find(m => m.id === model);
  const selectedRatio = ASPECT_RATIOS.find(r => r.id === aspectRatio);
  const effectiveNumOutputs = model === 'qwen' ? 1 : numOutputs;
  const totalCost = (selectedModel?.credits || 0) * effectiveNumOutputs;

  // Get loading status message based on elapsed time
  const getLoadingStatus = () => {
    const messages = model === 'qwen' ? [
      { threshold: 10, message: 'Queued, waiting for GPU...' },
      { threshold: 30, message: 'Processing with ComfyUI...' },
      { threshold: 60, message: 'Still generating...' },
      { threshold: 999, message: 'Taking longer than usual...' },
    ] : [
      { threshold: 5, message: 'Sending to API...' },
      { threshold: 20, message: 'Generating images...' },
      { threshold: 60, message: 'Still processing...' },
      { threshold: 999, message: 'Taking longer than usual...' },
    ];

    for (const { threshold, message } of messages) {
      if (loadingElapsed < threshold) return message;
    }
    return messages[messages.length - 1].message;
  };

  // Fetch gallery images from database (scoped to active model)
  const fetchGallery = useCallback(async () => {
    try {
      let url = '/api/gallery?type=image&limit=100';
      if (activeModel?.id) url += `&model_id=${activeModel.id}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${getAuthToken()}` },
      });
      if (response.ok) {
        const data = await response.json();
        setImages(data.items || []);
      }
    } catch (err) {
      console.error('Failed to fetch gallery:', err);
    } finally {
      setLoadingGallery(false);
    }
  }, [activeModel?.id]);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  // Track loading time
  useEffect(() => {
    if (!loading) {
      setLoadingElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [loading]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const endpointMap = {
        seedream: '/api/generate/seedream',
        'nano-banana': '/api/generate/nano-banana',
        qwen: '/api/generate/qwen',
      };

      const modelId = activeModel?.id || null;
      let body;
      if (model === 'seedream') {
        body = { prompt, width: selectedRatio.width, height: selectedRatio.height, numOutputs: effectiveNumOutputs, model_id: modelId };
      } else if (model === 'qwen') {
        body = { prompt, width: selectedRatio.qwenWidth || 1152, height: selectedRatio.qwenHeight || 1536, model_id: modelId };
      } else {
        body = { prompt, aspectRatio, numOutputs: effectiveNumOutputs, model_id: modelId };
      }

      const response = await fetch(endpointMap[model], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
        body: JSON.stringify(body),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Generation failed');

      await fetchGallery();
      refreshCredits();

      // Show success toast
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const clearImages = async () => {
    if (!confirm('Clear all generated images? This cannot be undone.')) return;
    try {
      const response = await fetch('/api/gallery', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getAuthToken()}` },
      });
      if (response.ok) setImages([]);
    } catch (err) {
      console.error('Failed to clear gallery:', err);
    }
  };

  const deleteImage = async (id) => {
    try {
      const response = await fetch(`/api/gallery/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${getAuthToken()}` },
      });
      if (response.ok) setImages(prev => prev.filter(img => img.id !== id));
    } catch (err) {
      console.error('Failed to delete image:', err);
    }
  };

  const downloadImage = async (imageUrl, id) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `generated-${id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  return (
    <Layout>
      <SuccessToast show={showSuccess} onClose={() => setShowSuccess(false)} />
      <PageHeader
        title="Image Generation"
        description="Create AI-generated images with multiple models"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
        {/* Left: Controls + Prompt */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="card-premium">
            <h2 className="text-lg font-bold text-text mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Generation Settings
            </h2>
            {/* Dropdowns row */}
            <div className="grid grid-cols-2 gap-3">
              <Dropdown
                label="Model"
                value={model}
                onChange={setModel}
                options={MODELS.map(m => ({ value: m.id, label: `${m.name} (${m.credits}cr)` }))}
              />
              <Dropdown
                label="Aspect Ratio"
                value={aspectRatio}
                onChange={setAspectRatio}
                options={ASPECT_RATIOS.map(r => ({ value: r.id, label: r.label }))}
              />
            </div>

            {/* Count dropdown (hidden for Qwen) */}
            {model !== 'qwen' && (
              <div className="mt-3">
                <Dropdown
                  label="Number of Images"
                  value={String(numOutputs)}
                  onChange={(v) => setNumOutputs(parseInt(v))}
                  options={[1, 2, 3, 4].map(n => ({ value: String(n), label: `${n} image${n > 1 ? 's' : ''}` }))}
                />
              </div>
            )}

            {/* Prompt */}
            <div className="mt-4 space-y-1.5">
              <label className="text-sm font-medium text-text-muted">Prompt</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={5}
                placeholder="Describe the image you want to generate..."
                className="w-full bg-background border border-border rounded-lg p-3 text-text text-sm focus:border-primary focus:ring-2 focus:ring-primary/20 focus:shadow-glow transition-all duration-200 resize-none"
              />
              <div className="text-xs text-text-muted text-right">{prompt.length} / 500</div>
            </div>

            {error && (
              <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                {error}
              </div>
            )}

            {/* Cost Display */}
            <div className="mt-4 flex items-center gap-3 bg-surface-elevated border border-border rounded-lg px-3 py-2.5 shadow-sm">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-semibold text-text">{totalCost} credits</div>
                <div className="text-xs text-text-muted">{credits?.agencyPool?.toLocaleString() || 0} available</div>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || loading}
              className="btn-gradient w-full flex items-center justify-center gap-2 mt-3"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Zap className="h-5 w-5" />
                  <span>Generate ({totalCost} credits)</span>
                </>
              )}
            </button>
          </Card>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Loading */}
          {loading && (
            <Card className="card-premium text-center py-12 animate-pulse-slow">
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-primary/10 mb-6 animate-float">
                <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow-lg animate-spin-slow">
                  <Loader2 className="h-10 w-10 text-white" />
                </div>
              </div>
              <h3 className="text-xl font-bold text-text mb-2">Generating your images...</h3>
              <p className="text-sm text-text-muted">
                {getLoadingStatus()}
              </p>
            </Card>
          )}

          {/* Gallery */}
          {images.length > 0 && (
            <>
              <div className="flex justify-between items-center">
                <p className="text-sm text-text-muted">{images.length} image{images.length !== 1 ? 's' : ''}</p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={fetchGallery}>
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                  <Button variant="ghost" size="sm" onClick={clearImages}>
                    <Trash2 className="h-4 w-4 mr-1" />
                    Clear All
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {images.map((image, index) => (
                  <div
                    key={image.id}
                    className="stagger-item relative group rounded-xl overflow-hidden border border-border bg-surface"
                    style={{ animationDelay: `${Math.min(index * 0.05, 0.3)}s` }}
                  >
                    <img
                      src={image.url}
                      alt={image.title || 'Generated image'}
                      className="w-full aspect-square object-cover"
                      loading="lazy"
                    />
                    {/* Bottom-right action bar */}
                    <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => downloadImage(image.url, image.id)}
                        className="p-1.5 rounded-full bg-black/70 text-white hover:bg-black/90 transition-colors"
                        title="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                      <SendToMenu imageUrl={image.url} />
                      <button
                        onClick={() => deleteImage(image.id)}
                        className="p-1.5 rounded-full bg-black/70 text-red-400 hover:bg-black/90 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {/* Bottom gradient with title */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 pt-6 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                      <p className="text-white text-xs truncate">{image.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Empty state */}
          {!loading && !loadingGallery && images.length === 0 && (
            <Card className="card-premium text-center py-16 animate-fade-in">
              {/* Animated Icon Container */}
              <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-primary/10 mb-6 animate-float">
                <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
                  <Image className="h-10 w-10 text-white" />
                </div>
              </div>

              {/* Heading with Gradient */}
              <h3 className="text-2xl font-bold text-text mb-3">
                Ready to <span className="text-transparent bg-clip-text bg-gradient-primary">Create</span> Something Amazing?
              </h3>

              {/* Description */}
              <p className="text-text-muted max-w-md mx-auto mb-6 leading-relaxed">
                Describe your vision in the prompt above and let AI bring it to life. Choose your style, set the aspect ratio, and generate stunning images in seconds.
              </p>

              {/* CTA Steps */}
              <div className="flex items-center justify-center gap-8 text-sm text-text-muted">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-bold">1</span>
                  </div>
                  <span>Choose model</span>
                </div>
                <ArrowRight className="h-4 w-4" />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-bold">2</span>
                  </div>
                  <span>Write prompt</span>
                </div>
                <ArrowRight className="h-4 w-4" />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span className="text-primary font-bold">3</span>
                  </div>
                  <span>Generate</span>
                </div>
              </div>
            </Card>
          )}

          {loadingGallery && !loading && (
            <Card className="card-premium">
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-text-muted">Loading gallery...</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
