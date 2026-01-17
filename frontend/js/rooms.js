// ====== Config ======
const BASE_URL = 'http://localhost:3000';

// ====== Fetch helpers (JWT via Auth.fetchAuthed) ======
async function getRooms()     { return Auth.fetchAuthed('/rooms',        { method: 'GET'  }, { baseUrl: BASE_URL }); }
async function addRoom(name)  { return Auth.fetchAuthed('/rooms/add',    { method: 'POST', body: JSON.stringify({ newRoomName: name }) }, { baseUrl: BASE_URL }); }
async function deleteRoom(id) {
    return Auth.fetchAuthed(`/rooms/${encodeURIComponent(id)}`, { method: 'DELETE' }, { baseUrl: BASE_URL });
  }

document.addEventListener('DOMContentLoaded', () => {
  // Require a valid, non-expired token
  if (!Auth.requireAuthOrRedirect('index.html')) return;

  // Get user & role from stored user (fallback to 'user')
  const user = Auth.getUser() || {};
  const role = user.role || 'user';

  const roleText    = document.getElementById('role-text');
  const createSect  = document.getElementById('create-room-section');
  const newRoomName = document.getElementById('new-room-name');
  const createBtn   = document.getElementById('create-room-btn');

  const roomsSelect = document.getElementById('rooms-select');
  const refreshBtn  = document.getElementById('refresh-btn');
  const joinBtn     = document.getElementById('join-room-btn');
  const deleteBtn   = document.getElementById('delete-room-btn');
  const statusEl    = document.getElementById('status');

  roleText.textContent = role;
  if (role === 'admin') {
    createSect.style.display = '';
  } else {
    createSect.style.display = 'none';
    deleteBtn.style.display  = 'none';
  }

  function setStatus(msg) { statusEl.textContent = msg || ''; }
  function setBusy(b) {
    [createBtn, refreshBtn, joinBtn, deleteBtn].forEach(btn => { if (btn) btn.disabled = !!b; });
    roomsSelect.disabled = !!b;
    if (b) setStatus('Working…');
  }

  function populateRooms(rooms) {
    roomsSelect.innerHTML = '';
    if (!rooms || !rooms.length) {
      console.log('No rooms');
      roomsSelect.innerHTML = '<option value="" disabled selected>No rooms found</option>';
      joinBtn.disabled = true;
      if (role === 'admin') deleteBtn.disabled = true;
      return;
    }
    for (const r of rooms) {
      const opt = document.createElement('option');
      opt.value = r.id;          // adjust if server field differs
      opt.textContent = r.name;  // adjust if server field differs
      roomsSelect.appendChild(opt);
    }
    joinBtn.disabled = false;
    if (role === 'admin') deleteBtn.disabled = false;
  }

  async function refreshRooms() {
    setBusy(true);
    try {
      const roomsObj = await getRooms();
      populateRooms(roomsObj.rooms || []);
      setStatus('Rooms loaded.');
    } catch (e) {
      populateRooms([]);
      setStatus(`Failed to load rooms: ${e.message}`);
    } finally {
      setBusy(false);
    }
  }

  refreshBtn.addEventListener('click', refreshRooms);

  roomsSelect.addEventListener('change', () => {
    const selected = roomsSelect.value;
    joinBtn.disabled = !selected;
    if (role === 'admin') deleteBtn.disabled = !selected;
  });

  if (createBtn) {
    createBtn.addEventListener('click', async () => {
      const name = newRoomName.value.trim();
      if (!name) { setStatus('Please enter a room name.'); return; }
      setBusy(true);
      try {
        await addRoom(name);
        newRoomName.value = '';
        await refreshRooms();
        setStatus('Room created.');
        Swal.fire({
          title: 'Success!',
          text: 'Your data has been saved.',
          icon: 'success'
        });
      } catch (e) {
        setStatus(`Create failed: ${e.message}`);
      } finally {
        setBusy(false);
      }
    });
  }

  // Navigate Rooms → Chat
  joinBtn.addEventListener('click', () => {
    const id = roomsSelect.value;
    if (!id) { setStatus('Please select a room.'); return; }
    const name = roomsSelect.options[roomsSelect.selectedIndex]?.textContent || 'Room';
    window.location.href = `chat.html?id=${encodeURIComponent(id)}&name=${encodeURIComponent(name)}`;
  });

  if (role === 'admin') {
    deleteBtn.addEventListener('click', async () => {
        const id = roomsSelect.value;
        const name = roomsSelect.options[roomsSelect.selectedIndex]?.textContent || '';
        if (!id) { setStatus('Please select a room.'); return; }
        if (!confirm(`Delete room "${name}"?`)) return;
        setBusy(true);
        try {
          await deleteRoom(id);
          await refreshRooms();
          setStatus('Room deleted.');
        } catch (e) {
          setStatus(`Delete failed: ${e.message}`);
        } finally {
          setBusy(false);
        }
      });
  }
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      Auth.clearAuth();               // clears token + user:contentReference[oaicite:2]{index=2}
      window.location.href = 'index.html';  // go back to login page
    });
  }
  // Initial load
  refreshRooms();
});
