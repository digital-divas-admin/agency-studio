/**
 * LoadingSpinner Component
 * Spinner with elapsed time and status messages.
 * Ported from Vixxxen's inpaint loading pattern.
 */

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Status messages based on elapsed time.
 * Matches Vixxxen's GPU queue → processing → elapsed time pattern.
 */
function getStatusMessage(elapsedSeconds, customMessages) {
  if (customMessages) {
    for (const { threshold, message } of customMessages) {
      if (elapsedSeconds < threshold) return message;
    }
    return customMessages[customMessages.length - 1]?.message || `Processing... (${elapsedSeconds}s)`;
  }

  if (elapsedSeconds < 10) return 'Queued, waiting for GPU...';
  if (elapsedSeconds < 30) return 'Processing image...';
  if (elapsedSeconds < 60) return `Processing... (${elapsedSeconds}s)`;
  if (elapsedSeconds < 120) return `Still working... (${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s)`;
  return `Taking longer than usual... (${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s)`;
}

export function LoadingSpinner({
  label = 'Generating...',
  showTimer = true,
  statusMessages,
  className = '',
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!showTimer) return;
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [showTimer]);

  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
      <p className="text-text font-medium">{label}</p>
      {showTimer && (
        <p className="text-sm text-text-muted mt-2">
          {getStatusMessage(elapsed, statusMessages)}
        </p>
      )}
    </div>
  );
}
