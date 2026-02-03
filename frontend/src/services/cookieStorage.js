/**
 * Cookie Storage for Supabase Auth
 * Implements a secure cookie-based storage for JWT tokens
 * to prevent XSS attacks via localStorage
 */

/**
 * Set a cookie with secure flags
 */
function setCookie(key, value, options = {}) {
  const {
    maxAge = 60 * 60 * 24 * 7, // 7 days default
    path = '/',
    sameSite = 'Lax',
    secure = window.location.protocol === 'https:',
  } = options;

  let cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
  cookie += `; Max-Age=${maxAge}`;
  cookie += `; Path=${path}`;
  cookie += `; SameSite=${sameSite}`;

  if (secure) {
    cookie += '; Secure';
  }

  document.cookie = cookie;
}

/**
 * Get a cookie value by key
 */
function getCookie(key) {
  const cookies = document.cookie.split('; ');

  for (const cookie of cookies) {
    const [cookieKey, cookieValue] = cookie.split('=');
    if (decodeURIComponent(cookieKey) === key) {
      return decodeURIComponent(cookieValue);
    }
  }

  return null;
}

/**
 * Delete a cookie by key
 */
function deleteCookie(key) {
  document.cookie = `${encodeURIComponent(key)}=; Max-Age=0; Path=/`;
}

/**
 * Custom storage implementation for Supabase Auth
 * Note: httpOnly flag can only be set server-side, but this implementation
 * still improves security by:
 * 1. Using SameSite=Lax to prevent CSRF
 * 2. Using Secure flag in production (HTTPS only)
 * 3. Setting appropriate Max-Age to limit exposure window
 */
export const cookieStorage = {
  getItem: (key) => {
    return getCookie(key);
  },

  setItem: (key, value) => {
    setCookie(key, value, {
      maxAge: 60 * 60 * 24 * 7, // 7 days
      secure: window.location.protocol === 'https:',
      sameSite: 'Lax',
    });
  },

  removeItem: (key) => {
    deleteCookie(key);
  },
};

/**
 * IMPORTANT NOTE:
 *
 * For true httpOnly cookie security, the auth flow should be modified to:
 * 1. Have the backend server set the auth token as an httpOnly cookie
 * 2. Use a session-based approach where the backend validates the cookie
 * 3. Frontend never has direct access to the JWT token
 *
 * This would require:
 * - Custom Supabase auth flow through your backend
 * - Backend middleware to extract and validate the httpOnly cookie
 * - Cookie set by backend with httpOnly, Secure, and SameSite flags
 *
 * The current implementation is a security improvement over localStorage,
 * but full httpOnly protection requires backend involvement.
 */
