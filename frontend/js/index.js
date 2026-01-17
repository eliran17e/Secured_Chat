const BASE_URL = 'http://localhost:3000';

function opts(body) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function postJson(path, payload) {
  const res = await fetch(`${BASE_URL}${path}`, opts(payload));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return data;
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const btn  = document.getElementById('login-button');
  const nameEl = document.getElementById('login-id'); // Updated to reflect 'name' instead of 'id'
  const pwEl = document.getElementById('login-password');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = nameEl.value.trim(); // Send 'name' instead of 'id'
    const password = pwEl.value.trim();
    if (!name || !password) { alert('Please enter both Name and Password.'); return; }

    btn.disabled = true;
    try {
      // Expecting server to return: { token, id }
      const result = await postJson('/auth/login', { name, password });
    
      if (result?.token) {
        Auth.setToken(result.token); // Save the token
      }
      if (result?.id) {
        localStorage.setItem('user_id', result.id); // Save the id in local storage
      }
      if (result?.role) {
        Auth.setUser({ role: result.role });
      }

      localStorage.setItem("token", result.token);
      window.location.href = 'rooms.html';
    } catch (err) {
      alert(`Login failed: ${err.message}`);
    } finally {
      btn.disabled = false;
    }
  });
});
