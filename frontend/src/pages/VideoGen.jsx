/**
 * Video Generation Page
 * Generate videos with Kling 2.5, WAN 2.2, and Veo 3.1
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Video,
  Upload,
  Download,
  Zap,
  Trash2,
  RefreshCw,
  Play,
  Volume2,
  X,
} from 'lucide-react';
import { Layout, PageHeader, Card } from '../components/layout/Layout';
import { Button } from '../components/common/Button';
import { Textarea } from '../components/common/Input';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useAuth } from '../context/AuthContext';
import { useModel } from '../context/ModelContext';
import { api } from '../services/api';

// ============================================================================
// MODEL DEFINITIONS
// ============================================================================

const MODELS = [
  {
    id: 'kling',
    name: 'Kling 2.5 Turbo Pro',
    credits: 50,
    description: 'High quality video, supports start image',
    supportsImage: true,
    supportsDuration: true,
    durationRange: [1, 10],
    defaultDuration: 5,
    aspectRatios: ['16:9', '9:16', '1:1'],
  },
  {
    id: 'wan',
    name: 'WAN 2.2',
    credits: 40,
    description: 'Image-to-video generation',
    supportsImage: true,
    supportsDuration: false,
    aspectRatios: [],
  },
  {
    id: 'veo',
    name: 'Veo 3.1 Fast',
    credits: 60,
    description: 'Google Veo with audio generation',
    supportsImage: true,
    supportsDuration: true,
    durationRange: [5, 8],
    defaultDuration: 8,
    aspectRatios: ['16:9', '9:16', '1:1'],
    supportsAudio: true,
  },
];

function getAuthToken() {
  try {
    const tokenData = localStorage.getItem('supabase.auth.token');
    if (tokenData) return JSON.parse(tokenData).access_token;
  } catch {}
  return '';
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export function VideoGenPage() {
  const { credits, refreshCredits } = useAuth();
  const { selectedModel: activeModel } = useModel();
  const location = useLocation();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const [modelId, setModelId] = useState('kling');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [duration, setDuration] = useState(5);
  const [generateAudio, setGenerateAudio] = useState(true);
  const [startImage, setStartImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingGallery, setLoadingGallery] = useState(true);
  const [error, setError] = useState('');
  const [videos, setVideos] = useState([]);

  const selectedModel = MODELS.find((m) => m.id === modelId);

  // Handle incoming image from SendToMenu via location.state
  useEffect(() => {
    if (location.state?.image) {
      setStartImage(location.state.image);
      // Clear location state so refreshing doesn't re-trigger
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state]);

  // Reset model-specific settings when switching models
  useEffect(() => {
    if (selectedModel?.defaultDuration) {
      setDuration(selectedModel.defaultDuration);
    }
    if (selectedModel?.aspectRatios?.length > 0) {
      setAspectRatio(selectedModel.aspectRatios[0]);
    }
  }, [modelId]);

  // Fetch video gallery (scoped to active model)
  const fetchGallery = useCallback(async () => {
    try {
      const params = { type: 'video', limit: 50 };
      if (activeModel?.id) params.model_id = activeModel.id;
      const data = await api.getGallery(params);
      setVideos(data.items || []);
    } catch (err) {
      console.error('Failed to fetch video gallery:', err);
    } finally {
      setLoadingGallery(false);
    }
  }, [activeModel?.id]);

  useEffect(() => {
    fetchGallery();
  }, [fetchGallery]);

  // Handle image upload
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    setStartImage(dataUrl);
    e.target.value = '';
  };

  // Generate video
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setError('');
    setLoading(true);

    try {
      let data;

      const agencyModelId = activeModel?.id || null;

      switch (modelId) {
        case 'kling':
          data = await api.generateKling({
            prompt,
            aspectRatio,
            duration,
            model_id: agencyModelId,
            ...(startImage && { startImage }),
          });
          break;

        case 'wan':
          data = await api.generateWan({
            prompt,
            model_id: agencyModelId,
            ...(startImage && { image: startImage }),
          });
          break;

        case 'veo':
          data = await api.generateVeo({
            prompt,
            aspectRatio,
            duration,
            generateAudio,
            model_id: agencyModelId,
            ...(startImage && { image: startImage }),
          });
          break;
      }

      // Refresh gallery to show new video
      await fetchGallery();
      refreshCredits();
    } catch (err) {
      setError(err.message || 'Video generation failed');
    } finally {
      setLoading(false);
    }
  };

  const deleteVideo = async (id) => {
    try {
      await api.deleteGalleryItem(id);
      setVideos((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      console.error('Failed to delete video:', err);
    }
  };

  return (
    <Layout>
      <PageHeader
        title="Video Generation"
        description="Create AI-generated videos with multiple models"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Controls */}
        <div className="lg:col-span-1 space-y-4">
          {/* Model Selection */}
          <Card>
            <h3 className="font-semibold text-text mb-3">Model</h3>
            <div className="space-y-2">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setModelId(m.id)}
                  className={`w-full p-3 rounded-lg border text-left transition-colors ${
                    modelId === m.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-medium text-text">{m.name}</p>
                      <p className="text-sm text-text-muted">{m.description}</p>
                    </div>
                    <span className="text-sm text-primary font-medium">{m.credits} credits</span>
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {/* Aspect Ratio (Kling, Veo) */}
          {selectedModel?.aspectRatios?.length > 0 && (
            <Card>
              <h3 className="font-semibold text-text mb-3">Aspect Ratio</h3>
              <div className="grid grid-cols-3 gap-2">
                {selectedModel.aspectRatios.map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`p-2 rounded-lg border text-sm transition-colors ${
                      aspectRatio === ratio
                        ? 'border-primary bg-primary/10 text-text'
                        : 'border-border text-text-muted hover:border-primary/50'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* Duration (Kling, Veo) */}
          {selectedModel?.supportsDuration && (
            <Card>
              <h3 className="font-semibold text-text mb-3">
                Duration: {duration}s
              </h3>
              <input
                type="range"
                min={selectedModel.durationRange[0]}
                max={selectedModel.durationRange[1]}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full accent-pink-500"
              />
              <div className="flex justify-between text-xs text-text-muted mt-1">
                <span>{selectedModel.durationRange[0]}s</span>
                <span>{selectedModel.durationRange[1]}s</span>
              </div>
            </Card>
          )}

          {/* Audio (Veo only) */}
          {selectedModel?.supportsAudio && (
            <Card>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateAudio}
                  onChange={(e) => setGenerateAudio(e.target.checked)}
                  className="w-4 h-4 rounded accent-pink-500"
                />
                <div>
                  <p className="font-medium text-text">Generate Audio</p>
                  <p className="text-sm text-text-muted">AI-generated sound effects and music</p>
                </div>
                <Volume2 className="h-5 w-5 text-text-muted ml-auto" />
              </label>
            </Card>
          )}

          {/* Start Image (optional for all models) */}
          {selectedModel?.supportsImage && (
            <Card>
              <h3 className="font-semibold text-text mb-3">Start Image (optional)</h3>
              {startImage ? (
                <div className="relative">
                  <img src={startImage} alt="Start" className="w-full rounded-lg" />
                  <button
                    onClick={() => setStartImage(null)}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary transition-colors"
                >
                  <Upload className="h-6 w-6 text-text-muted mx-auto mb-2" />
                  <p className="text-sm text-text-muted">Upload a start image</p>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </Card>
          )}

          {/* Cost Summary */}
          <Card className="bg-surface-elevated">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                <span className="text-text-muted">Cost</span>
              </div>
              <span className="text-xl font-bold text-text">
                {selectedModel?.credits || 0} credits
              </span>
            </div>
            <p className="text-sm text-text-muted mt-1">
              Available: {credits?.agencyPool?.toLocaleString() || 0} credits
            </p>
          </Card>
        </div>

        {/* Prompt and Results */}
        <div className="lg:col-span-2 space-y-4">
          {/* Prompt Input */}
          <Card>
            <Textarea
              label="Prompt"
              placeholder="Describe the video you want to generate..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
            />

            {error && (
              <div className="mt-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                {error}
              </div>
            )}

            <Button
              onClick={handleGenerate}
              loading={loading}
              disabled={!prompt.trim() || loading}
              className="w-full mt-4"
            >
              {loading ? 'Generating...' : `Generate Video (${selectedModel?.credits || 0} credits)`}
            </Button>
          </Card>

          {/* Loading */}
          {loading && (
            <Card>
              <LoadingSpinner
                label="Generating your video..."
                showTimer={true}
                statusMessages={[
                  { threshold: 10, message: 'Sending to API...' },
                  { threshold: 30, message: 'Rendering frames...' },
                  { threshold: 60, message: 'Still processing...' },
                  { threshold: 120, message: 'Video generation can take 1-3 minutes...' },
                  { threshold: 999, message: 'Almost there...' },
                ]}
              />
            </Card>
          )}

          {/* Video Gallery */}
          {videos.length > 0 && (
            <>
              <div className="flex justify-between items-center">
                <p className="text-sm text-text-muted">
                  {videos.length} video{videos.length !== 1 ? 's' : ''} in gallery
                </p>
                <Button variant="ghost" size="sm" onClick={fetchGallery}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {videos.map((video) => (
                  <Card key={video.id} className="p-2">
                    <div className="relative group">
                      <video
                        src={video.url}
                        controls
                        className="w-full rounded-lg"
                        preload="metadata"
                      />
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => deleteVideo(video.id)}
                          className="p-2 rounded-full bg-black/60 text-red-400 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 px-2 pb-2">
                        <p className="text-xs text-text-muted truncate">{video.title}</p>
                        <p className="text-xs text-text-muted">{video.tags?.join(', ')}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* Empty state */}
          {!loading && !loadingGallery && videos.length === 0 && (
            <Card>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Video className="h-12 w-12 text-text-muted mb-4" />
                <p className="text-text-muted">Your generated videos will appear here</p>
                <p className="text-sm text-text-muted mt-1">
                  Enter a prompt and click Generate to get started
                </p>
              </div>
            </Card>
          )}

          {loadingGallery && !loading && (
            <Card>
              <LoadingSpinner label="Loading gallery..." showTimer={false} />
            </Card>
          )}
        </div>
      </div>
    </Layout>
  );
}
