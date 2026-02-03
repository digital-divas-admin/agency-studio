/**
 * Login Page
 * User authentication
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAgency } from '../context/AgencyContext';
import { Button } from '../components/common/Button';
import { Input } from '../components/common/Input';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { signIn } = useAuth();
  const { branding } = useAgency();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  // Background styles for custom login background
  const backgroundStyles = branding.login_background_url
    ? {
        backgroundImage: `linear-gradient(rgba(0, 0, 0, ${branding.login_background_overlay_opacity || 0.7}), rgba(0, 0, 0, ${branding.login_background_overlay_opacity || 0.7})), url(${branding.login_background_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    : {};

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background p-4"
      style={backgroundStyles}
    >
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          {branding.logo_url ? (
            <img
              src={branding.logo_url}
              alt={branding.app_name}
              className="h-12 mx-auto mb-4"
            />
          ) : (
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-white text-xl font-bold mx-auto mb-4">
              {branding.app_name?.charAt(0) || 'A'}
            </div>
          )}
          <h1 className="text-2xl font-bold text-text">{branding.app_name}</h1>
          <p className="text-text-muted mt-2">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <div
          className={`bg-surface rounded-xl border border-border p-6 ${
            branding.login_background_url ? 'backdrop-blur-sm bg-surface/95 shadow-2xl' : ''
          }`}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
                {error}
              </div>
            )}

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-text-muted">
                <input
                  type="checkbox"
                  className="rounded border-border bg-surface"
                />
                Remember me
              </label>
              <Link
                to="/forgot-password"
                className="text-primary hover:text-primary-hover"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" loading={loading} className="w-full">
              Sign In
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-text-muted text-sm mt-6">
          Don't have an account?{' '}
          <Link to="/signup" className="text-primary hover:text-primary-hover">
            Sign up for free
          </Link>
        </p>
      </div>
    </div>
  );
}
