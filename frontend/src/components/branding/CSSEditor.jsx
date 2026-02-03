import { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { AlertTriangle, Info, Lock, Eye, EyeOff } from 'lucide-react';

const DANGEROUS_PATTERNS = [
  { pattern: /javascript:/gi, warning: 'javascript: URLs are not allowed' },
  { pattern: /@import/gi, warning: '@import statements are not allowed' },
  { pattern: /expression\s*\(/gi, warning: 'CSS expressions are not allowed' },
  { pattern: /behavior\s*:/gi, warning: 'behavior property is not allowed' },
  { pattern: /-moz-binding/gi, warning: '-moz-binding is not allowed' },
  { pattern: /vbscript:/gi, warning: 'vbscript: URLs are not allowed' },
  { pattern: /data:text\/html/gi, warning: 'data:text/html is not allowed' }
];

const EXAMPLE_CSS = `/* Example: Custom button styles */
.custom-button {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  padding: 12px 24px;
  transition: transform 0.2s;
}

.custom-button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(102, 126, 234, 0.4);
}

/* Example: Custom card styling */
.custom-card {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}`;

export function CSSEditor({ value = '', onChange, locked = false }) {
  const [css, setCSS] = useState(value || '');
  const [warnings, setWarnings] = useState([]);
  const [showPreview, setShowPreview] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    // Validate CSS for dangerous patterns
    const foundWarnings = [];
    DANGEROUS_PATTERNS.forEach(({ pattern, warning }) => {
      if (pattern.test(css)) {
        foundWarnings.push(warning);
      }
    });
    setWarnings(foundWarnings);
  }, [css]);

  // Sync local state with prop value when it changes (e.g., when API data loads)
  useEffect(() => {
    setCSS(value || '');
  }, [value]);

  const handleChange = (newValue) => {
    setCSS(newValue || '');
    // Only propagate sanitized CSS
    const sanitized = sanitizeCSS(newValue || '');
    onChange(sanitized);
  };

  const handleLoadExample = () => {
    setCSS(EXAMPLE_CSS);
    onChange(sanitizeCSS(EXAMPLE_CSS));
  };

  if (locked) {
    return (
      <div className="opacity-50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text-primary">Custom CSS</h3>
          <div className="px-3 py-1 bg-warning/10 border border-warning/20 rounded-full text-sm text-warning">
            Enterprise Only
          </div>
        </div>
        <p className="text-sm text-text-muted mb-4">
          Upgrade to Enterprise tier to inject custom CSS styles
        </p>
        <div className="h-64 bg-surface/50 border-2 border-dashed border-border rounded-lg flex items-center justify-center">
          <div className="text-center">
            <Lock className="h-12 w-12 mx-auto mb-2 text-text-muted" />
            <p className="text-sm text-text-muted">Custom CSS Editor</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">Custom CSS</h3>
          <p className="text-sm text-text-muted mt-1">
            Inject custom styles to further customize your platform
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="p-2 text-text-muted hover:text-text-primary transition-colors"
            title="Show help"
          >
            <Info className="h-5 w-5" />
          </button>
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="px-4 py-2 text-sm border border-border rounded-lg
                     text-text-primary hover:bg-surface transition-colors flex items-center gap-2"
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showPreview ? 'Hide' : 'Show'} Preview
          </button>
          <button
            onClick={handleLoadExample}
            className="px-4 py-2 text-sm border border-border rounded-lg
                     text-text-primary hover:bg-surface transition-colors"
          >
            Load Example
          </button>
        </div>
      </div>

      {showHelp && (
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
            <div className="text-sm space-y-2">
              <p className="font-medium text-text-primary">Custom CSS Guidelines</p>
              <ul className="list-disc list-inside space-y-1 text-text-muted">
                <li>Use standard CSS syntax (no preprocessors)</li>
                <li>Prefix your classes with <code className="px-1 py-0.5 bg-surface rounded text-xs">.custom-</code> to avoid conflicts</li>
                <li>CSS is automatically sanitized for security</li>
                <li>Maximum size: 50KB</li>
                <li>Changes apply immediately when you save</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="p-4 bg-error/10 border border-error/20 rounded-lg">
          <div className="flex gap-3">
            <AlertTriangle className="h-5 w-5 text-error flex-shrink-0 mt-0.5" />
            <div className="text-sm space-y-1">
              <p className="font-medium text-error">Security Warnings</p>
              {warnings.map((warning, i) => (
                <p key={i} className="text-error">{warning}</p>
              ))}
              <p className="text-text-muted mt-2">
                These patterns will be automatically removed when you save.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="border border-border rounded-lg overflow-hidden">
        <Editor
          height="400px"
          defaultLanguage="css"
          value={css}
          onChange={handleChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on'
          }}
        />
      </div>

      {showPreview && css && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text-primary">
            Preview (Raw CSS)
          </label>
          <div className="p-4 bg-surface border border-border rounded-lg">
            <pre className="text-xs text-text-muted overflow-x-auto">
              <code>{sanitizeCSS(css)}</code>
            </pre>
          </div>
          <p className="text-xs text-text-muted">
            ℹ️ This shows the sanitized CSS that will be applied. Dangerous patterns have been removed.
          </p>
        </div>
      )}

      <div className="text-xs text-text-muted">
        <span className="font-medium">Size:</span> {css.length.toLocaleString()} / 50,000 characters
        {css.length > 50000 && (
          <span className="text-error ml-2">• Exceeds maximum size</span>
        )}
      </div>
    </div>
  );
}

/**
 * Sanitize CSS to remove dangerous patterns
 * This matches the backend sanitization
 */
function sanitizeCSS(css) {
  if (!css || typeof css !== 'string') {
    return '';
  }

  let sanitized = css;

  // Remove dangerous patterns
  DANGEROUS_PATTERNS.forEach(({ pattern }) => {
    sanitized = sanitized.replace(pattern, '');
  });

  // Limit size
  const maxLength = 50000;
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}
