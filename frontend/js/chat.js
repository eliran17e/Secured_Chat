let socket;

function qs(name, def = '') {
  const url = new URL(window.location.href);
  return url.searchParams.get(name) ?? def;
}

function escapeHTML(s = '') {
  return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#039;'}[c]));
}

function fmtTime() {
  return new Date().toLocaleTimeString();
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!Auth.requireAuthOrRedirect('index.html')) return;

  const roomId = qs('id');
  const roomName = qs('name') || 'Room';
  if (!roomId) {
    alert('Missing room id');
    window.location.href = 'rooms.html';
    return;
  }

  const historyEl = document.getElementById('history');
  const membersEl = document.getElementById('members');
  const msgInput  = document.getElementById('msg-input');
  const sendBtn   = document.getElementById('send-btn');
  const backBtn   = document.getElementById('back-btn');
  const membersHeader = document.getElementById('membersHeader');
  const loadingEl = document.querySelector('.loading');
  document.getElementById('room-title').textContent = roomName;

  backBtn.addEventListener('click', () => window.location.href = 'rooms.html');

  // Connect to socket.io server
  const token = Auth.getToken();
  socket = io("http://localhost:3000", { auth: { token } });

  socket.on("connect", () => {
    addSystemMessage("✅ Connected to server");
    socket.emit("joinRoom", roomId); // join immediately
  });

  socket.on("disconnect", () => {
    addSystemMessage("❌ Disconnected from server");
  });

  socket.on("systemMessage", (msg) => {
    addSystemMessage("[SYSTEM] " + msg);
    loadingEl.classList.add('hidden');
  });

  socket.on("chatMessage", (data) => {
    addChatMessage(data.sender, data.text, data.room);
    loadingEl.classList.add('hidden');
  });

  socket.on("roomMembers", (list) => {
    renderMembers(list);
  });

  function addSystemMessage(text) {
    const div = document.createElement("div");
    div.className = "msg";
    div.innerHTML = `<span class="user">System:</span> ${escapeHTML(text)} <span class="time">${fmtTime()}</span>`;
    historyEl.appendChild(div);
    historyEl.scrollTop = historyEl.scrollHeight;
  }

  function addChatMessage(sender, text, room) {
    const div = document.createElement("div");
    div.className = "msg";
    div.innerHTML = `<span class="user">${escapeHTML(sender)}:</span> ${escapeHTML(text)} <span class="time">${fmtTime()}</span>`;
    historyEl.appendChild(div);
    historyEl.scrollTop = historyEl.scrollHeight;
  }

  function renderMembers(list) {
    membersEl.innerHTML = "";
    list.forEach(u => {
      const div = document.createElement("div");
      div.className = "member";
      div.textContent = u || u.username || u.id || "Unknown";
      membersEl.appendChild(div);
    });
  }

  sendBtn.addEventListener('click', () => {
    loadingEl.classList.remove('hidden');
    const msg = msgInput.value.trim();
    if (!msg) return;
    socket.emit("chatMessage", { roomId, message: msg });
    msgInput.value = "";
  });

  msgInput.addEventListener('keydown', (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  // Fetch and render members from the server
  try {
    const response = await fetch(`http://localhost:3000/rooms/${roomId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch room members');
    }

    const result = await response.json();
    renderMembers(result.members || []);
    membersHeader.textContent = `Members (${result.members.length})`;
  } catch (error) {
    console.error('Error fetching members:', error);
    addSystemMessage('⚠️ Failed to load members');
  }
});