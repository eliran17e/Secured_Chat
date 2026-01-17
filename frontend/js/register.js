const BASE_URL = 'http://localhost:3000';
const USE_COOKIES = false; // set true if server uses cookie-based sessions

function opts(body) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...(USE_COOKIES ? { credentials: 'include' } : {}),
  };
}

async function postJson(path, payload) {
  const res = await fetch(`${BASE_URL}${path}`, opts(payload));
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { message: text }; }
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data;
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('register-form');
  const btn = document.getElementById('register-button');
  const idEl = document.getElementById('register-id');
  const pwEl = document.getElementById('register-password');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = idEl.value.trim();
    const password = pwEl.value.trim();
    if (!name || !password) { alert('Please enter both ID and Password.'); return; }

    btn.disabled = true;
    try {
      await postJson('/auth/register', { name, password });
      alert('Registration successful! Redirecting to login page...');
      window.location.href = 'index.html';
    } catch (err) {
      alert(`Registration failed: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  });
});
