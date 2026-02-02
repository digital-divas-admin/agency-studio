/**
 * MaskCanvas Component
 * Reusable canvas brush tool for painting masks over images.
 * Ported from Vixxxen's inpaint/eraser dual-canvas architecture.
 *
 * Usage:
 *   <MaskCanvas
 *     imageSrc={dataUrl}          // The image to paint over
 *     onMaskGenerated={fn}        // Called with { image: base64, mask: base64 }
 *     brushSize={30}              // Initial brush size
 *     maxDimension={2048}         // Max output dimension
 *   />
 */

import { useRef, useState, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Undo2, Eraser, Trash2 } from 'lucide-react';

const BRUSH_COLOR = 'rgba(255, 46, 187, 0.7)';
const MAX_UNDO_HISTORY = 20;

const MaskCanvas = forwardRef(function MaskCanvas({
  imageSrc,
  onClear,
  brushSizeExternal,
  maxDimension = 2048,
}, ref) {
  const wrapperRef = useRef(null);
  const imageCanvasRef = useRef(null);
  const maskCanvasRef = useRef(null);
  const loadedImageRef = useRef(null);
  const isDrawingRef = useRef(false);
  const historyRef = useRef([]);

  const [brushSize, setBrushSize] = useState(brushSizeExternal || 30);
  const [hasMask, setHasMask] = useState(false);
  const [canvasReady, setCanvasReady] = useState(false);

  // Sync external brush size
  useEffect(() => {
    if (brushSizeExternal !== undefined) {
      setBrushSize(brushSizeExternal);
    }
  }, [brushSizeExternal]);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    getMaskData,
    hasMaskDrawn: () => hasMask,
    clearMask: handleClearMask,
    getImageData: () => {
      const canvas = imageCanvasRef.current;
      if (!canvas) return null;
      return canvas.toDataURL('image/png');
    },
  }));

  /**
   * Generate separate image + mask base64 data.
   * Mask: white = painted area (inpaint/erase), black = keep.
   */
  const getMaskData = useCallback(() => {
    const imageCanvas = imageCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const img = loadedImageRef.current;
    if (!imageCanvas || !maskCanvas || !img) return null;

    // Calculate output dimensions (cap at maxDimension)
    const scale = Math.min(maxDimension / img.width, maxDimension / img.height, 1);
    const outputWidth = Math.round(img.width * scale);
    const outputHeight = Math.round(img.height * scale);

    // 1. Original image at output resolution
    const imgOut = document.createElement('canvas');
    imgOut.width = outputWidth;
    imgOut.height = outputHeight;
    const imgCtx = imgOut.getContext('2d');
    imgCtx.drawImage(img, 0, 0, outputWidth, outputHeight);

    // 2. Black/white mask at output resolution
    const maskOut = document.createElement('canvas');
    maskOut.width = outputWidth;
    maskOut.height = outputHeight;
    const maskOutCtx = maskOut.getContext('2d');

    // Start black (keep everything)
    maskOutCtx.fillStyle = '#000000';
    maskOutCtx.fillRect(0, 0, outputWidth, outputHeight);

    // Scale painted mask strokes to output size
    const scaledMask = document.createElement('canvas');
    scaledMask.width = outputWidth;
    scaledMask.height = outputHeight;
    const scaledCtx = scaledMask.getContext('2d');
    scaledCtx.drawImage(maskCanvas, 0, 0, outputWidth, outputHeight);

    // Convert pink alpha → white
    const srcData = scaledCtx.getImageData(0, 0, outputWidth, outputHeight);
    const dstData = maskOutCtx.getImageData(0, 0, outputWidth, outputHeight);

    for (let i = 0; i < srcData.data.length; i += 4) {
      if (srcData.data[i + 3] > 0) {
        dstData.data[i] = 255;
        dstData.data[i + 1] = 255;
        dstData.data[i + 2] = 255;
        dstData.data[i + 3] = 255;
      }
    }
    maskOutCtx.putImageData(dstData, 0, 0);

    // Return base64 WITHOUT data URL prefix (matches backend expectation)
    return {
      image: imgOut.toDataURL('image/png').split(',')[1],
      mask: maskOut.toDataURL('image/png').split(',')[1],
      width: outputWidth,
      height: outputHeight,
    };
  }, [maxDimension]);

  // Load image when imageSrc changes
  useEffect(() => {
    if (!imageSrc) {
      setCanvasReady(false);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImageRef.current = img;

      const imageCanvas = imageCanvasRef.current;
      const maskCanvas = maskCanvasRef.current;
      const wrapper = wrapperRef.current;
      if (!imageCanvas || !maskCanvas || !wrapper) return;

      // Calculate display size to fit wrapper
      const wrapperWidth = wrapper.clientWidth;
      const wrapperHeight = Math.min(wrapper.clientHeight || 600, 600);
      const displayScale = Math.min(wrapperWidth / img.width, wrapperHeight / img.height, 1);
      const displayWidth = Math.floor(img.width * displayScale);
      const displayHeight = Math.floor(img.height * displayScale);

      // Set internal canvas size to full image resolution
      imageCanvas.width = img.width;
      imageCanvas.height = img.height;
      maskCanvas.width = img.width;
      maskCanvas.height = img.height;

      // Set display size
      imageCanvas.style.width = displayWidth + 'px';
      imageCanvas.style.height = displayHeight + 'px';
      maskCanvas.style.width = displayWidth + 'px';
      maskCanvas.style.height = displayHeight + 'px';

      // Draw image
      const ctx = imageCanvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // Clear mask
      const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
      maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);

      historyRef.current = [];
      setHasMask(false);
      setCanvasReady(true);
    };
    img.onerror = () => {
      console.error('Failed to load image for mask canvas');
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Get coordinate scale factor
  const getScale = useCallback(() => {
    const canvas = imageCanvasRef.current;
    if (!canvas || !canvas.offsetWidth) return 1;
    return canvas.width / canvas.offsetWidth;
  }, []);

  // Get position from mouse/touch event
  const getPos = useCallback((e) => {
    const canvas = imageCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scale = getScale();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scale,
      y: (clientY - rect.top) * scale,
    };
  }, [getScale]);

  // Drawing handlers
  const startDrawing = useCallback((e) => {
    e.preventDefault();
    isDrawingRef.current = true;

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });

    // Save state for undo
    const state = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
    historyRef.current.push(state);
    if (historyRef.current.length > MAX_UNDO_HISTORY) {
      historyRef.current.shift();
    }

    // Configure brush
    maskCtx.strokeStyle = BRUSH_COLOR;
    maskCtx.lineCap = 'round';
    maskCtx.lineJoin = 'round';
    maskCtx.lineWidth = brushSize * getScale();

    const pos = getPos(e);
    maskCtx.beginPath();
    maskCtx.moveTo(pos.x, pos.y);

    // Draw a dot for single click
    maskCtx.fillStyle = BRUSH_COLOR;
    maskCtx.beginPath();
    maskCtx.arc(pos.x, pos.y, (brushSize * getScale()) / 2, 0, Math.PI * 2);
    maskCtx.fill();
    maskCtx.beginPath();
    maskCtx.moveTo(pos.x, pos.y);

    setHasMask(true);
  }, [brushSize, getScale, getPos]);

  const draw = useCallback((e) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;

    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });

    maskCtx.strokeStyle = BRUSH_COLOR;
    maskCtx.lineCap = 'round';
    maskCtx.lineJoin = 'round';
    maskCtx.lineWidth = brushSize * getScale();

    const pos = getPos(e);
    maskCtx.lineTo(pos.x, pos.y);
    maskCtx.stroke();
    maskCtx.beginPath();
    maskCtx.moveTo(pos.x, pos.y);
  }, [brushSize, getScale, getPos]);

  const stopDrawing = useCallback(() => {
    isDrawingRef.current = false;
  }, []);

  // Clear mask strokes
  const handleClearMask = useCallback(() => {
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    ctx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    historyRef.current = [];
    setHasMask(false);
  }, []);

  // Undo last stroke
  const handleUndo = useCallback(() => {
    if (historyRef.current.length === 0) return;
    const maskCanvas = maskCanvasRef.current;
    if (!maskCanvas) return;
    const ctx = maskCanvas.getContext('2d');
    const prev = historyRef.current.pop();
    ctx.putImageData(prev, 0, 0);

    // Check if mask still has content
    if (historyRef.current.length === 0) {
      const data = ctx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
      let hasContent = false;
      for (let i = 3; i < data.data.length; i += 4) {
        if (data.data[i] > 0) { hasContent = true; break; }
      }
      setHasMask(hasContent);
    }
  }, []);

  // Clear everything and notify parent
  const handleClearImage = useCallback(() => {
    loadedImageRef.current = null;
    historyRef.current = [];
    setHasMask(false);
    setCanvasReady(false);
    if (onClear) onClear();
  }, [onClear]);

  if (!imageSrc) return null;

  return (
    <div className="space-y-3">
      {/* Brush Controls */}
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <label className="text-xs text-text-muted mb-1 block">
            Brush Size: {brushSize}px
          </label>
          <input
            type="range"
            min="5"
            max="100"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-full accent-pink-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleUndo}
            disabled={historyRef.current.length === 0}
            className="p-2 rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface-elevated transition-colors disabled:opacity-30"
            title="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={handleClearMask}
            disabled={!hasMask}
            className="p-2 rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface-elevated transition-colors disabled:opacity-30"
            title="Clear mask"
          >
            <Eraser className="h-4 w-4" />
          </button>
          <button
            onClick={handleClearImage}
            className="p-2 rounded-lg border border-border text-pink-400 hover:text-pink-300 hover:bg-pink-500/10 transition-colors"
            title="Clear image"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={wrapperRef}
        className="relative bg-black/50 rounded-lg overflow-hidden border border-border flex items-center justify-center"
        style={{ minHeight: '300px' }}
      >
        <canvas
          ref={imageCanvasRef}
          style={{ display: canvasReady ? 'block' : 'none', cursor: 'crosshair' }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
        />
        <canvas
          ref={maskCanvasRef}
          className="absolute"
          style={{
            display: canvasReady ? 'block' : 'none',
            pointerEvents: 'none',
            opacity: 0.6,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
        {!canvasReady && (
          <div className="text-text-muted text-sm py-12">Loading image...</div>
        )}
      </div>

      {/* Brush Preview */}
      <div className="flex items-center gap-2 text-xs text-text-muted">
        <div
          className="rounded-full flex-shrink-0"
          style={{
            width: Math.min(brushSize, 40),
            height: Math.min(brushSize, 40),
            backgroundColor: BRUSH_COLOR,
          }}
        />
        <span>Paint over areas to {hasMask ? 'edit' : 'select'}</span>
      </div>
    </div>
  );
});

export { MaskCanvas };
