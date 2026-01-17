// auth.js — shared JWT + user helpers (no modules, globals on window)

(function () {
    const TOKEN_KEY = 'auth_token';
    const USER_KEY  = 'auth_user'; // we'll store the server-returned user object here
  
    function setToken(token) {
      if (token) localStorage.setItem(TOKEN_KEY, token);
    }
    function getToken() {
      return localStorage.getItem(TOKEN_KEY) || '';
    }
    function clearToken() {
      localStorage.removeItem(TOKEN_KEY);
    }
  
    function setUser(userObj) {
      try { localStorage.setItem(USER_KEY, JSON.stringify(userObj || {})); }
      catch { /* ignore */ }
    }
    function getUser() {
      try { return JSON.parse(localStorage.getItem(USER_KEY) || '{}'); }
      catch { return {}; }
    }
    function clearUser() {
      localStorage.removeItem(USER_KEY);
    }
  
    // base64url decode
    function b64urlToStr(b64url) {
      const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
      const pad = '='.repeat((4 - (b64.length % 4)) % 4);
      const bin = atob(b64 + pad);
      try {
        return decodeURIComponent(bin.split('').map(c => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''));
      } catch { return bin; }
    }
  
    function decodeJwt(token) {
      if (!token || token.split('.').length !== 3) return null;
      try {
        const payload = token.split('.')[1];
        return JSON.parse(b64urlToStr(payload));
      } catch {
        return null;
      }
    }
  
    function tokenExpiresAt(token) {
      const payload = decodeJwt(token);
      return payload?.exp ? payload.exp * 1000 : null; // ms
    }
  
    function isTokenExpired(token) {
      const exp = tokenExpiresAt(token);
      return exp ? Date.now() >= exp : false; // if no exp -> treat as not expired
    }
  
    function authHeaders() {
      const t = getToken();
      return t ? { Authorization: `Bearer ${t}` } : {};
    }
  
    // If token missing/expired -> redirect to login
    function requireAuthOrRedirect(loginPage = 'index.html') {
      const t = getToken();
      if (!t || isTokenExpired(t)) {
        clearAuth();
        window.location.href = loginPage;
        return false;
      }
      return true;
    }
  
    // Fetch wrapper that auto-sends JWT and redirects on 401
    async function fetchAuthed(url, options = {}, { baseUrl = '' } = {}) {
      const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
        ...authHeaders(),
      };
      const res = await fetch(`${baseUrl}${url}`, { ...options, headers });
  
      if (res.status === 401) {
        clearAuth();
        window.location.href = 'index.html';
        throw new Error('Unauthorized');
      }
  
      const text = await res.text();
      let data;
      try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      return data;
    }
  
    function clearAuth() {
      clearToken();
      clearUser();
    }
  
    // expose on window
    window.Auth = {
      setToken, getToken, clearAuth, decodeJwt, tokenExpiresAt, isTokenExpired,
      setUser, getUser, authHeaders, requireAuthOrRedirect, fetchAuthed,
    };
  })();
  