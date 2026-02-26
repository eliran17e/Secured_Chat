// ====== Config ======
const BASE_URL = 'http://localhost:3000';

// ====== Fetch helpers (JWT via Auth.fetchAuthed) ======
async function getRooms()     { return Auth.fetchAuthed('/rooms',        { method: 'GET'  }, { baseUrl: BASE_URL }); }
async function addRoom(name)  { return Auth.fetchAuthed('/rooms/add',    { method: 'POST', body: JSON.stringify({ newRoomName: name }) }, { baseUrl: BASE_URL }); }
async function deleteRoom(id) {
    return Auth.fetchAuthed(`/rooms/${encodeURIComponent(id)}`, { method: 'DELETE' }, { baseUrl: BASE_URL });
  }

// ====== Admin API helpers ======
async function getAdminConfig() { 
  return Auth.fetchAuthed('/admin/config', { method: 'GET' }, { baseUrl: BASE_URL }); 
}
async function updateUrlThreshold(threshold) { 
  return Auth.fetchAuthed('/admin/config/url-threshold', { 
    method: 'PUT', 
    body: JSON.stringify({ threshold }) 
  }, { baseUrl: BASE_URL }); 
}
async function updateDlpConfig(config) { 
  return Auth.fetchAuthed('/admin/config/dlp', { 
    method: 'PUT', 
    body: JSON.stringify(config) 
  }, { baseUrl: BASE_URL }); 
}
async function getBlockedUrlStats() { 
  return Auth.fetchAuthed('/admin/blocked-urls/stats', { method: 'GET' }, { baseUrl: BASE_URL }); 
}
async function getRecentBlockedUrls() { 
  return Auth.fetchAuthed('/admin/blocked-urls/recent', { method: 'GET' }, { baseUrl: BASE_URL }); 
}

document.addEventListener('DOMContentLoaded', () => {
  // Require a valid, non-expired token
  if (!Auth.requireAuthOrRedirect('/')) return;

  // Get user & role from stored user (fallback to 'user')
  const user = Auth.getUser() || {};
  const role = user.role || 'user';

  const roleText    = document.getElementById('role-text');
  const createSect  = document.getElementById('create-room-section');
  const adminConfigSect = document.getElementById('admin-config-section');
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
    adminConfigSect.style.display = '';
    initAdminConfig(); // Initialize admin configuration
  } else {
    createSect.style.display = 'none';
    adminConfigSect.style.display = 'none';
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
      window.location.href = '/';  // go back to login page
    });
  }
  // ====== Admin Configuration Functions ======
  async function initAdminConfig() {
    try {
      // Load current configuration
      const configData = await getAdminConfig();
      const config = configData.config;
      
      // Update UI with current values
      document.getElementById('current-url-threshold').textContent = config.urlRiskThreshold;
      document.getElementById('url-threshold').value = config.urlRiskThreshold;
      document.getElementById('dlp-enabled').checked = config.dlpEnabled;
      document.getElementById('dlp-threshold').value = config.dlpThreshold;
      
      // Load blocked URL stats
      await loadBlockedUrlStats();
      
      // Setup event listeners
      setupAdminEventListeners();
      
    } catch (error) {
      console.error('Failed to load admin configuration:', error);
      setStatus('Failed to load admin configuration');
    }
  }
  
  async function loadBlockedUrlStats() {
    try {
      const statsData = await getBlockedUrlStats();
      const stats = statsData.stats;
      
      document.getElementById('blocked-urls-count').textContent = stats.totalUrls || 0;
      document.getElementById('total-blocks').textContent = stats.totalBlockCount || 0;
    } catch (error) {
      console.error('Failed to load blocked URL stats:', error);
    }
  }
  
  function setupAdminEventListeners() {
    // URL Threshold Update
    const urlThresholdBtn = document.getElementById('update-url-threshold-btn');
    const urlThresholdInput = document.getElementById('url-threshold');
    
    urlThresholdBtn.addEventListener('click', async () => {
      const threshold = parseInt(urlThresholdInput.value);
      if (isNaN(threshold) || threshold < 0 || threshold > 100) {
        setStatus('URL threshold must be between 0 and 100');
        return;
      }
      
      try {
        urlThresholdBtn.disabled = true;
        urlThresholdBtn.textContent = 'Updating...';
        
        const result = await updateUrlThreshold(threshold);
        
        // Update current value display
        document.getElementById('current-url-threshold').textContent = threshold;
        
        setStatus('URL threshold updated successfully');
        
        // Visual feedback
        const configGroup = urlThresholdBtn.closest('.config-group');
        configGroup.classList.add('updated');
        setTimeout(() => configGroup.classList.remove('updated'), 2000);
        
        // Show success notification
        Swal.fire({
          title: 'Success!',
          text: `URL risk threshold updated to ${threshold}`,
          icon: 'success',
          timer: 3000
        });
        
      } catch (error) {
        setStatus(`Failed to update URL threshold: ${error.message}`);
        Swal.fire({
          title: 'Error',
          text: `Failed to update URL threshold: ${error.message}`,
          icon: 'error'
        });
      } finally {
        urlThresholdBtn.disabled = false;
        urlThresholdBtn.textContent = 'Update';
      }
    });
    
    // DLP Configuration Update
    const dlpBtn = document.getElementById('update-dlp-btn');
    const dlpEnabledInput = document.getElementById('dlp-enabled');
    const dlpThresholdInput = document.getElementById('dlp-threshold');
    const dlpAdvanced = document.querySelector('.dlp-advanced');
    
    // Show/hide advanced DLP settings
    dlpEnabledInput.addEventListener('change', () => {
      dlpAdvanced.style.display = dlpEnabledInput.checked ? 'block' : 'none';
    });
    
    // Trigger initial display
    dlpAdvanced.style.display = dlpEnabledInput.checked ? 'block' : 'none';
    
    dlpBtn.addEventListener('click', async () => {
      const config = {
        enabled: dlpEnabledInput.checked
      };
      
      if (dlpEnabledInput.checked) {
        const threshold = parseFloat(dlpThresholdInput.value);
        
        if (!isNaN(threshold) && threshold >= 0.0 && threshold <= 1.0) {
          config.threshold = threshold;
        }
      }
      
      try {
        dlpBtn.disabled = true;
        dlpBtn.textContent = 'Updating...';
        
        const result = await updateDlpConfig(config);
        
        setStatus('DLP configuration updated successfully');
        
        // Visual feedback
        const configGroup = dlpBtn.closest('.config-group');
        configGroup.classList.add('updated');
        setTimeout(() => configGroup.classList.remove('updated'), 2000);
        
        // Show success notification
        Swal.fire({
          title: 'Success!',
          text: 'DLP configuration updated successfully',
          icon: 'success',
          timer: 3000
        });
        
      } catch (error) {
        setStatus(`Failed to update DLP configuration: ${error.message}`);
        Swal.fire({
          title: 'Error',
          text: `Failed to update DLP configuration: ${error.message}`,
          icon: 'error'
        });
      } finally {
        dlpBtn.disabled = false;
        dlpBtn.textContent = 'Update DLP';
      }
    });
    
    // Blocked URLs View
    const viewBlockedUrlsBtn = document.getElementById('view-blocked-urls-btn');
    viewBlockedUrlsBtn.addEventListener('click', async () => {
      try {
        const urlsData = await getRecentBlockedUrls();
        const urls = urlsData.urls;
        
        if (urls.length === 0) {
          Swal.fire({
            title: 'No Blocked URLs',
            text: 'No URLs have been blocked yet.',
            icon: 'info'
          });
          return;
        }
        
        const urlsList = urls.map(url => 
          `<div style="text-align: left; margin: 10px 0; padding: 10px; background: #f8f9fa; border-radius: 5px;">
            <strong>${url.url}</strong><br>
            <small>Score: ${url.riskScore} | Blocked: ${url.blockedCount} times | Last: ${new Date(url.lastDetected).toLocaleDateString()}</small>
          </div>`
        ).join('');
        
        Swal.fire({
          title: 'Recent Blocked URLs',
          html: `<div style="max-height: 400px; overflow-y: auto;">${urlsList}</div>`,
          width: '600px',
          confirmButtonText: 'Close'
        });
        
      } catch (error) {
        Swal.fire({
          title: 'Error',
          text: `Failed to load blocked URLs: ${error.message}`,
          icon: 'error'
        });
      }
    });
  }

  // Initial load
  refreshRooms();
});