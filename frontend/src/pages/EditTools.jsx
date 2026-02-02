/**
 * Edit Tools Page
 * Background Remover, Object Eraser, Qwen Image Edit, Inpainting
 *
 * Eraser and Inpaint use the MaskCanvas brush tool (ported from Vixxxen).
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Wand2,
  Eraser,
  Paintbrush,
  ImageMinus,
  Upload,
  Download,
  Trash2,
  ArrowLeft,
  Zap,
  Image as ImageIcon,
  Plus,
  X,
  Sparkles,
  Check,
  ArrowRight,
} from 'lucide-react';
import { Layout, PageHeader, Card } from '../components/layout/Layout';
import { Button } from '../components/common/Button';
import { Textarea } from '../components/common/Input';
import { MaskCanvas } from '../components/common/MaskCanvas';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { SendToMenu } from '../components/common/SendToMenu';
import { ImagePicker } from '../components/common/ImagePicker';
import { useAuth } from '../context/AuthContext';
import { useModel } from '../context/ModelContext';
import { api } from '../services/api';

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const TOOLS = [
  {
    id: 'bg-remover',
    name: 'Background Remover',
    description: 'Remove backgrounds from any image with one click',
    icon: ImageMinus,
    credits: 3,
    needsMask: false,
    needsPrompt: false,
    maxImages: 1,
  },
  {
    id: 'eraser',
    name: 'Object Eraser',
    description: 'Paint over objects to remove them from the image',
    icon: Eraser,
    credits: 3,
    needsMask: true,
    needsPrompt: false,
    maxImages: 1,
  },
  {
    id: 'qwen-edit',
    name: 'AI Image Edit',
    description: 'Edit images with text prompts — describe your changes',
    icon: Wand2,
    credits: 5,
    needsMask: false,
    needsPrompt: true,
    maxImages: 3,
  },
  {
    id: 'inpaint',
    name: 'Inpaint',
    description: 'Paint over areas and describe what should replace them',
    icon: Paintbrush,
    credits: 5,
    needsMask: true,
    needsPrompt: true,
    maxImages: 1,
  },
];

// ============================================================================
// HELPERS
// ============================================================================

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

function downloadImage(url, name) {
  const a = document.createElement('a');
  a.href = url;
  a.download = name || 'edited.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function getToolDescription(toolId) {
  const descriptions = {
    'bg-remover': 'Instantly remove backgrounds from any image with precision AI detection',
    'eraser': 'Paint over unwanted objects and watch them disappear seamlessly',
    'qwen-edit': 'Describe your changes in natural language and let AI transform your image',
    'inpaint': 'Fill selected areas with AI-generated content that matches your scene',
  };
  return descriptions[toolId] || '';
}

function getEmptyStateText(toolId) {
  const texts = {
    'bg-remover': 'Upload an image and watch as AI perfectly removes the background in seconds. Great for product photos, portraits, and more.',
    'eraser': 'Paint over unwanted elements in your image and let AI seamlessly fill the space. Perfect for cleaning up photos.',
    'qwen-edit': 'Describe your desired changes in natural language and let AI intelligently transform your image to match your vision.',
    'inpaint': 'Select areas to regenerate with AI that perfectly matches the surrounding context. Ideal for creative modifications.',
  };
  return texts[toolId] || 'Upload an image to begin editing with AI-powered tools.';
}

function getLoadingStatus(toolId, elapsed) {
  if (elapsed < 10) return 'Preparing your image...';
  if (elapsed < 20) return 'AI is analyzing...';
  if (elapsed < 30) return 'Generating results...';
  return 'Almost done...';
}

function getRandomTip() {
  const tips = [
    'Try different denoise strengths for varied results',
    'You can edit multiple images at once',
    'Results are automatically saved to your gallery',
    'Use specific prompts for better AI edits',
    'The eraser tool works best on clear objects',
  ];
  return tips[Math.floor(Math.random() * tips.length)];
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
          <p className="text-sm text-green-100">Your edit is ready</p>
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
// TOOL SELECTOR (landing view)
// ============================================================================

function ToolSelector({ onSelect }) {
  return (
    <div className="space-y-8 animate-fade-in">
      {/* Hero Header */}
      <div className="text-center max-w-2xl mx-auto space-y-4">
        <h1 className="text-4xl font-bold text-text">
          Professional <span className="text-transparent bg-clip-text bg-gradient-primary">Editing Tools</span>
        </h1>
        <p className="text-lg text-text-muted">
          Transform your images with AI-powered editing tools. Choose a tool below to get started.
        </p>
      </div>

      {/* Tool Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {TOOLS.map((tool, index) => {
          const Icon = tool.icon;
          return (
            <button
              key={tool.id}
              onClick={() => onSelect(tool)}
              className="stagger-item card-premium card-interactive text-left p-8 group relative"
            >
              {/* Credit Badge - Top Right */}
              <div className="absolute top-4 right-4 bg-primary/10 border border-primary/30 px-3 py-1 rounded-full">
                <span className="text-sm font-semibold text-primary">{tool.credits} credits</span>
              </div>

              {/* Icon Container with Gradient Background */}
              <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-primary shadow-glow group-hover:shadow-glow-lg transition-all duration-300">
                <Icon className="h-8 w-8 text-white" />
              </div>

              {/* Tool Info */}
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-text group-hover:text-primary transition-colors">
                  {tool.name}
                </h3>
                <p className="text-text-muted text-sm leading-relaxed">
                  {getToolDescription(tool.id)}
                </p>
              </div>

              {/* Feature Tags */}
              <div className="mt-4 flex flex-wrap gap-2">
                {tool.needsMask && (
                  <span className="text-xs bg-surface px-2 py-1 rounded-full text-text-muted">
                    Mask Support
                  </span>
                )}
                {tool.needsPrompt && (
                  <span className="text-xs bg-surface px-2 py-1 rounded-full text-text-muted">
                    AI-Powered
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// IMAGE UPLOAD AREA
// ============================================================================

function ImageUploadArea({ onUpload, maxImages = 1, images = [], onRemoveImage }) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  const handleFiles = async (files) => {
    const newImages = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      if (images.length + newImages.length >= maxImages) break;
      const dataUrl = await fileToDataUrl(file);
      newImages.push(dataUrl);
    }
    if (newImages.length > 0) onUpload(newImages);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const canAddMore = images.length < maxImages;

  if (images.length > 0) {
    return (
      <div className="space-y-3">
        {/* Thumbnail Grid with Animation */}
        <div className="grid grid-cols-3 gap-3">
          {images.map((url, index) => (
            <div
              key={index}
              className="relative group aspect-square rounded-lg overflow-hidden border-2 border-border hover:border-primary transition-all animate-scale-in"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <img
                src={url}
                alt={`Upload ${index + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
              />

              {/* Remove Button - Larger and More Visible */}
              <button
                onClick={() => onRemoveImage(index)}
                className="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-110"
                title="Remove"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Image Number Badge */}
              <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded-full text-xs text-white font-medium">
                #{index + 1}
              </div>
            </div>
          ))}

          {/* Add More Button - Enhanced */}
          {canAddMore && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary bg-surface-elevated hover:bg-surface transition-all group flex flex-col items-center justify-center gap-2 card-interactive"
            >
              <Plus className="h-8 w-8 text-text-muted group-hover:text-primary transition-colors" />
              <span className="text-xs text-text-muted group-hover:text-text">Add Image</span>
            </button>
          )}
        </div>

        {/* Image Count Helper */}
        <p className="text-xs text-text-muted text-center">
          {images.length} / {maxImages} images uploaded
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Enhanced Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
          transition-all duration-300 group
          ${isDragging
            ? 'border-primary bg-primary/10 scale-105 shadow-glow'
            : 'border-border hover:border-primary/50 bg-surface-elevated hover:bg-surface'
          }
        `}
      >
        {/* Icon with Animation */}
        <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4 transition-all duration-300 ${isDragging ? 'scale-110 animate-float' : 'group-hover:scale-105'}`}>
          <Upload className={`h-8 w-8 transition-colors ${isDragging ? 'text-primary animate-pulse' : 'text-text-muted group-hover:text-primary'}`} />
        </div>

        {/* Text */}
        <p className="text-text font-semibold mb-2">
          {isDragging ? 'Drop your images here' : 'Drag & drop images here'}
        </p>
        <p className="text-sm text-text-muted mb-4">
          or click to browse (max {maxImages} {maxImages > 1 ? 'images' : 'image'})
        </p>

        {/* Supported Formats */}
        <div className="flex items-center justify-center gap-2 text-xs text-text-muted">
          <span className="px-2 py-1 bg-surface rounded">PNG</span>
          <span className="px-2 py-1 bg-surface rounded">JPG</span>
          <span className="px-2 py-1 bg-surface rounded">WEBP</span>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple={maxImages > 1}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {/* Alternative Upload Method */}
      <div className="mt-4 text-center">
        <ImagePicker
          onSelect={(url) => onUpload([url])}
        />
      </div>
    </div>
  );
}

// ============================================================================
// RESULT GALLERY
// ============================================================================

function ResultGallery({ results, originalImage }) {
  if (results.length === 0) return null;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Enhanced Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-text flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary animate-float" />
          Your Results
          <span className="text-sm font-normal text-text-muted ml-2">
            ({results.length} {results.length === 1 ? 'image' : 'images'})
          </span>
        </h2>

        {/* Batch Actions */}
        {results.length > 1 && (
          <button className="text-sm text-primary hover:text-primary-hover flex items-center gap-2 transition-colors">
            <Download className="h-4 w-4" />
            Download All
          </button>
        )}
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {results.map((url, index) => (
          <div
            key={index}
            className="card-premium group relative overflow-hidden animate-scale-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            {/* Result Image */}
            <img
              src={url}
              alt={`Result ${index + 1}`}
              className="w-full h-auto rounded-lg transition-transform duration-300 group-hover:scale-105"
            />

            {/* Action Overlay - Revealed on Hover */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-4">
              <div className="flex gap-2">
                {/* Download Button - Larger */}
                <button
                  onClick={() => downloadImage(url, `edit-result-${index + 1}.png`)}
                  className="bg-primary hover:bg-primary-hover text-white p-3 rounded-lg transition-all hover:scale-110 shadow-lg"
                  title="Download"
                >
                  <Download className="h-5 w-5" />
                </button>

                {/* Send To Menu */}
                <div className="[&>div>button]:bg-surface-elevated [&>div>button]:hover:bg-surface [&>div>button]:text-text [&>div>button]:p-3 [&>div>button]:rounded-lg [&>div>button]:transition-all [&>div>button]:hover:scale-110 [&>div>button]:shadow-lg">
                  <SendToMenu imageUrl={url} />
                </div>
              </div>

              {/* Image Number Badge */}
              <div className="bg-black/70 px-3 py-1 rounded-full text-sm text-white font-medium">
                #{index + 1}
              </div>
            </div>

            {/* Success Checkmark - Top Right */}
            <div className="absolute top-4 right-4 bg-green-500 rounded-full p-2 shadow-lg animate-scale-in">
              <Check className="h-4 w-4 text-white" />
            </div>
          </div>
        ))}
      </div>

      {/* Before/After Comparison - If Original Available */}
      {originalImage && results.length === 1 && (
        <Card className="card-premium mt-6">
          <h3 className="text-lg font-bold text-text mb-4">Comparison</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-text-muted mb-2">Before</p>
              <img src={originalImage} alt="Original" className="w-full rounded-lg border border-border" />
            </div>
            <div>
              <p className="text-sm text-text-muted mb-2">After</p>
              <img src={results[0]} alt="Result" className="w-full rounded-lg border border-primary shadow-glow" />
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// LOADING STATE
// ============================================================================

function LoadingState({ tool, elapsedTime = 0 }) {
  // Calculate progress percentage (fake progress for UX)
  const estimatedTime = tool.credits * 3; // seconds
  const progress = Math.min((elapsedTime / estimatedTime) * 100, 95);

  return (
    <Card className="card-premium text-center py-12 animate-pulse-slow">
      {/* Animated Icon */}
      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-primary/10 mb-6 animate-float">
        <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow-lg animate-spin-slow">
          {React.createElement(tool.icon, { className: 'h-10 w-10 text-white' })}
        </div>
      </div>

      {/* Status Text */}
      <h3 className="text-xl font-bold text-text mb-2">
        {getLoadingStatus(tool.id, elapsedTime)}
      </h3>
      <p className="text-text-muted mb-6">
        This usually takes {estimatedTime} seconds
      </p>

      {/* Progress Bar */}
      <div className="max-w-md mx-auto">
        <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-primary transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-text-muted mt-2">
          {Math.round(progress)}% complete
        </p>
      </div>

      {/* Fun Tips */}
      <div className="mt-8 p-4 bg-surface-elevated rounded-lg border border-border max-w-md mx-auto">
        <p className="text-sm text-text-muted italic">
          💡 {getRandomTip()}
        </p>
      </div>
    </Card>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState({ tool }) {
  return (
    <Card className="card-premium text-center py-16 animate-fade-in">
      {/* Animated Icon Container */}
      <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-gradient-primary/10 mb-6 animate-float">
        <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center shadow-glow">
          {React.createElement(tool.icon, { className: 'h-10 w-10 text-white' })}
        </div>
      </div>

      {/* Heading with Gradient */}
      <h3 className="text-2xl font-bold text-text mb-3">
        Ready to <span className="text-transparent bg-clip-text bg-gradient-primary">Transform</span> Your Images?
      </h3>

      {/* Description */}
      <p className="text-text-muted max-w-md mx-auto mb-6 leading-relaxed">
        {getEmptyStateText(tool.id)}
      </p>

      {/* CTA Steps */}
      <div className="flex items-center justify-center gap-8 text-sm text-text-muted">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-bold">1</span>
          </div>
          <span>Upload image</span>
        </div>
        <ArrowRight className="h-4 w-4" />
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary font-bold">2</span>
          </div>
          <span>{tool.needsPrompt ? 'Describe edit' : 'Paint mask'}</span>
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
  );
}

// ============================================================================
// TOOL WORKSPACE
// ============================================================================

function ToolWorkspace({ tool, onBack, initialImage }) {
  const { credits, refreshCredits } = useAuth();
  const { selectedModel: activeModel } = useModel();
  const maskCanvasRef = useRef(null);

  const [images, setImages] = useState(initialImage ? [initialImage] : []);
  const [prompt, setPrompt] = useState('');
  const [denoise, setDenoise] = useState(60); // 0-100, maps to 0-1
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState([]);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const loadingTimerRef = useRef(null);

  const handleUpload = useCallback((newImages) => {
    setImages((prev) => {
      const combined = [...prev, ...newImages];
      return combined.slice(0, tool.maxImages);
    });
    setError('');
  }, [tool.maxImages]);

  const handleRemoveImage = useCallback((index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearCanvas = useCallback(() => {
    setImages([]);
  }, []);

  // ---- GENERATE ----
  const handleGenerate = async () => {
    if (images.length === 0) {
      setError('Please upload an image first');
      return;
    }

    if (tool.needsPrompt && !prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    if (tool.needsMask) {
      const canvasRef = maskCanvasRef.current;
      if (!canvasRef || !canvasRef.hasMaskDrawn()) {
        setError('Please paint over the area you want to edit');
        return;
      }
    }

    setError('');
    setLoading(true);
    setElapsedTime(0);

    // Start timer for loading state
    loadingTimerRef.current = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);

    try {
      let data;

      const agencyModelId = activeModel?.id || null;

      switch (tool.id) {
        case 'bg-remover': {
          data = await api.removeBg({ image: images[0], model_id: agencyModelId });
          break;
        }

        case 'eraser': {
          const maskData = maskCanvasRef.current.getMaskData();
          data = await api.eraseObject({
            image: `data:image/png;base64,${maskData.image}`,
            mask: `data:image/png;base64,${maskData.mask}`,
            model_id: agencyModelId,
          });
          break;
        }

        case 'qwen-edit': {
          data = await api.qwenEdit({
            images,
            prompt: prompt.trim(),
            model_id: agencyModelId,
          });
          break;
        }

        case 'inpaint': {
          const maskData = maskCanvasRef.current.getMaskData();
          data = await api.inpaint({
            image: maskData.image,
            mask: maskData.mask,
            prompt: prompt.trim(),
            denoise: denoise / 100,
            width: maskData.width,
            height: maskData.height,
            model_id: agencyModelId,
          });
          break;
        }
      }

      // Extract images from response
      // bg-remover, eraser, inpaint return { image: url } (singular)
      // qwen-edit returns { images: [...] } (plural)
      const resultImages = data?.images || (data?.image ? [data.image] : []);
      if (resultImages.length > 0) {
        setResults((prev) => [...resultImages, ...prev]);
        setShowSuccessToast(true);
        setTimeout(() => setShowSuccessToast(false), 5000);
      } else {
        throw new Error('No images returned');
      }

      refreshCredits();
    } catch (err) {
      setError(err.message || 'Edit failed');
    } finally {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      setLoading(false);
    }
  };

  const loadingMessages = tool.id === 'inpaint'
    ? [
        { threshold: 10, message: 'Queued, waiting for GPU...' },
        { threshold: 30, message: 'Processing inpaint...' },
        { threshold: 60, message: 'Still generating...' },
        { threshold: 999, message: 'Taking longer than usual...' },
      ]
    : tool.id === 'eraser'
    ? [
        { threshold: 5, message: 'Sending to AI...' },
        { threshold: 20, message: 'Erasing objects...' },
        { threshold: 60, message: 'Still processing...' },
        { threshold: 999, message: 'Taking longer than usual...' },
      ]
    : undefined;

  return (
    <div className="animate-fade-in">
      <SuccessToast show={showSuccessToast} onClose={() => setShowSuccessToast(false)} />

      {/* Enhanced Header with Breadcrumb */}
      <div className="mb-8 space-y-4">
        {/* Back Navigation */}
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-text-muted hover:text-primary transition-colors group"
        >
          <ArrowLeft className="h-5 w-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Back to Tools</span>
        </button>

        {/* Tool Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Tool Icon */}
            <div className="w-14 h-14 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              {React.createElement(tool.icon, { className: 'h-7 w-7 text-white' })}
            </div>

            <div>
              <h1 className="text-3xl font-bold text-text">{tool.name}</h1>
              <p className="text-text-muted mt-1">
                {getToolDescription(tool.id)}
              </p>
            </div>
          </div>

          {/* Cost Display - Prominent */}
          <div className="flex items-center gap-3 bg-surface-elevated border border-border rounded-xl px-4 py-3">
            <Zap className="h-5 w-5 text-primary" />
            <div className="text-right">
              <div className="text-sm text-text-muted">Cost per edit</div>
              <div className="text-xl font-bold text-text">{tool.credits}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Workspace Grid - Improved Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Column: Controls - Sticky on Desktop */}
        <div className="xl:col-span-4 space-y-6">
          <div className="xl:sticky xl:top-6 space-y-6">
            {/* Image Upload Card */}
            {!tool.needsMask && (
              <Card className="card-premium">
                <h2 className="text-lg font-bold text-text mb-4 flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  Upload Image
                </h2>
                <ImageUploadArea
                  onUpload={handleUpload}
                  maxImages={tool.maxImages}
                  images={images}
                  onRemoveImage={handleRemoveImage}
                />
              </Card>
            )}

            {/* Upload for mask tools (single image, shown when no image yet) */}
            {tool.needsMask && images.length === 0 && (
              <Card className="card-premium">
                <h2 className="text-lg font-bold text-text mb-4 flex items-center gap-2">
                  <Upload className="h-5 w-5 text-primary" />
                  Upload Image
                </h2>
                <ImageUploadArea
                  onUpload={handleUpload}
                  maxImages={1}
                  images={images}
                  onRemoveImage={handleRemoveImage}
                />
              </Card>
            )}

            {/* Prompt Card - If Needed */}
            {tool.needsPrompt && (
              <Card className="card-premium animate-slide-up">
                <h2 className="text-lg font-bold text-text mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Describe Your Edit
                </h2>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    tool.id === 'inpaint'
                      ? "E.g., 'Replace with a golden sunset'"
                      : "E.g., 'Change the background to a beach sunset'"
                  }
                  rows={4}
                  className="w-full bg-background border border-border rounded-lg p-3 text-text focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <div className="mt-2 text-sm text-text-muted">
                  {prompt.length} / 500 characters
                </div>
              </Card>
            )}

            {/* Denoise Slider - If Needed */}
            {tool.id === 'inpaint' && images.length > 0 && (
              <Card className="card-premium animate-slide-up" style={{ animationDelay: '0.1s' }}>
                <h2 className="text-lg font-bold text-text mb-4">Strength</h2>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={denoise}
                  onChange={(e) => setDenoise(parseInt(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-text-muted mt-2">
                  <span>Subtle</span>
                  <span className="font-semibold text-primary">{denoise}%</span>
                  <span>Strong</span>
                </div>
              </Card>
            )}

            {/* Generate Button - Premium Style */}
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={loading || images.length === 0}
              className="btn-gradient w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <Wand2 className="h-5 w-5" />
                  <span>Generate ({tool.credits} credits)</span>
                </>
              )}
            </button>

            {/* Credit Balance Display */}
            <div className="text-center text-sm text-text-muted">
              Available: <span className="font-semibold text-text">{credits?.agencyPool?.toLocaleString() || 0}</span> credits
            </div>
          </div>
        </div>

        {/* Right Column: Canvas & Results */}
        <div className="xl:col-span-8 space-y-6">
          {/* Mask Canvas (for eraser & inpaint) */}
          {tool.needsMask && images.length > 0 && (
            <Card className="card-premium">
              <h3 className="text-lg font-bold text-text mb-4">
                {tool.id === 'inpaint'
                  ? 'Paint areas to replace'
                  : 'Paint over objects to remove'}
              </h3>
              <MaskCanvas
                ref={maskCanvasRef}
                imageSrc={images[0]}
                onClear={handleClearCanvas}
              />
            </Card>
          )}

          {/* Loading */}
          {loading && <LoadingState tool={tool} elapsedTime={elapsedTime} />}

          {/* Results */}
          <ResultGallery results={results} originalImage={images[0]} />

          {/* Empty state */}
          {!loading && results.length === 0 && (
            <EmptyState tool={tool} />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export function EditToolsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTool, setActiveTool] = useState(null);
  const [initialImage, setInitialImage] = useState(null);

  // Handle incoming image from SendToMenu via location.state
  useEffect(() => {
    const state = location.state;
    if (state?.image) {
      setInitialImage(state.image);

      // Auto-select tool if specified (e.g. 'inpaint'), otherwise default to 'bg-remover'
      const toolId = state.tool || 'bg-remover';
      const tool = TOOLS.find((t) => t.id === toolId);
      if (tool) setActiveTool(tool);

      // Clear location state so refreshing doesn't re-trigger
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state]);

  return (
    <Layout>
      {!activeTool ? (
        <>
          <PageHeader
            title="Edit Tools"
            description="Background removal, object erasing, inpainting, and AI-powered edits"
          />
          <ToolSelector onSelect={setActiveTool} />
        </>
      ) : (
        <ToolWorkspace
          tool={activeTool}
          onBack={() => { setActiveTool(null); setInitialImage(null); }}
          initialImage={initialImage}
        />
      )}
    </Layout>
  );
}
