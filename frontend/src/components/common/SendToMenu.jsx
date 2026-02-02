/**
 * SendToMenu Component
 * Dropdown menu for sending images to other tools (Video, Edit, Inpaint, Chat)
 * Converts image URL to base64 and navigates via React Router location.state
 */

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Video, Scissors, Paintbrush, MessageSquare } from 'lucide-react';

const DESTINATIONS = [
  { id: 'video', label: 'Send to Video', icon: Video, path: '/generate/video' },
  { id: 'edit', label: 'Send to Edit', icon: Scissors, path: '/edit' },
  { id: 'inpaint', label: 'Send to Inpaint', icon: Paintbrush, path: '/edit', tool: 'inpaint' },
  { id: 'chat', label: 'Send to Chat', icon: MessageSquare, path: '/chat' },
];

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

export function SendToMenu({ imageUrl, className = '' }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [converting, setConverting] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [open]);

  const handleSendTo = async (dest, e) => {
    e.stopPropagation();
    if (converting) return;

    setConverting(true);
    try {
      // Convert URL to base64 data URL
      let dataUrl = imageUrl;
      if (imageUrl.startsWith('http')) {
        dataUrl = await imageUrlToDataUrl(imageUrl);
      }

      setOpen(false);

      // Navigate with image in state
      navigate(dest.path, {
        state: {
          image: dataUrl,
          ...(dest.tool && { tool: dest.tool }),
        },
      });
    } catch (err) {
      console.error('Failed to send image:', err);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
        title="Send to..."
      >
        <Send className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg p-1 min-w-[160px] shadow-lg z-50">
          {DESTINATIONS.map((dest) => (
            <button
              key={dest.id}
              onClick={(e) => handleSendTo(dest, e)}
              disabled={converting}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white text-left rounded-md hover:bg-[rgba(255,46,187,0.15)] hover:text-[#ff2ebb] transition-colors disabled:opacity-50"
            >
              <dest.icon className="h-4 w-4 flex-shrink-0" />
              {converting ? 'Loading...' : dest.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
