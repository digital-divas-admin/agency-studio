import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from './Button';

/**
 * AccessDenied Component
 * Displays a friendly message when user doesn't have permission to access a resource
 */
export default function AccessDenied({
  title = "Access Denied",
  message = "You don't have permission to access this resource.",
  suggestion = "Contact your agency admin if you believe this is an error.",
  actionLabel = "Go to Dashboard",
  actionPath = "/dashboard"
}) {
  const navigate = useNavigate();

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
            <ShieldAlert className="w-8 h-8 text-red-600" />
          </div>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold text-gray-900 mb-3">
          {title}
        </h1>

        {/* Message */}
        <p className="text-gray-600 mb-2">
          {message}
        </p>

        {/* Suggestion */}
        {suggestion && (
          <p className="text-sm text-gray-500 mb-8">
            {suggestion}
          </p>
        )}

        {/* Action Button */}
        {actionLabel && actionPath && (
          <Button
            onClick={() => navigate(actionPath)}
            variant="primary"
          >
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
