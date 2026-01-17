const Room = require("../models/Room");
const { checkMessageUrls } = require("../utils/urlChecker");
const config = require("../config/config");
const { hasLeak } = require("../utils/dlpChecker");
const { prefilterMessage } = require("../utils/dlpAutomation");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log(`✅ ${socket.user.name} connected (id: ${socket.id})`);

    socket.on("joinRoom", async (roomId) => {
      const room = await Room.findById(roomId);
      if (!room) {
        socket.emit("errorMessage", "Room not found");
        return;
      }

      if (!room.users.map(u => u.toString()).includes(socket.user.id)) {
        room.users.push(socket.user.id);
        await room.save();
      }

      socket.join(roomId);
      console.log(`${socket.user.name} joined room ${room.name}`);
      io.to(roomId).emit("systemMessage", `${socket.user.name} joined the room`);
    });

    socket.on("chatMessage", async ({ roomId, message }) => {

      // check for malicious URLs
      const urlScan = await checkMessageUrls(message);
      // find the highest score across all URLs
      const maxScore = urlScan.reduce((acc, r) => Math.max(acc, r.score), 0);
      if (maxScore >= config.security.urlRiskThreshold) {
        // Find the URL result with the highest score for better reporting
        const blockedUrl = urlScan.find(r => r.score === maxScore);
        const fromDatabase = blockedUrl?.fromDatabase;
        
        console.log(`🚨 Message blocked (score ${maxScore} >= ${config.security.urlRiskThreshold})${fromDatabase ? ' - Found in blocked URL database' : ''}`);
        
        // Enhanced message based on source
        let blockMessage;
        if (fromDatabase) {
          const blockCount = blockedUrl.evidence?.database?.blockedCount || 1;
          blockMessage = `🚫 ${socket.user.name} tried to share a known malicious link (previously blocked ${blockCount} times). Message blocked.`;
        } else {
          blockMessage = `⚠️ ${socket.user.name} tried to share a dangerous link (risk score ${maxScore}). Message blocked.`;
        }
        
        io.to(roomId).emit("systemMessage", blockMessage);
        return;
      }

      // check for secret recipes data leak

      // prefilter: avoid unnecessary AI calls
      const { action, matches } = prefilterMessage(message);
      if (action === 'block') {
        console.log(`Blocked by prefilter (${matches.join(', ')}) from ${socket.user.name} in room ${roomId}`);
        socket.emit("systemMessage", "Message contains restricted content");
        return;
      }
      if (action === 'check') {
        const leaking = await hasLeak(message);
        if (leaking) {
          console.log(`Blocked leaking message from ${socket.user.name} in room ${roomId}`);
          socket.emit("systemMessage", "Message contains restricted content");
          return;
        }
      }

      // Broadcast the message to the room
      console.log(`[${roomId}] ${socket.user.name}: ${message}`);
      io.to(roomId).emit("chatMessage", {
        sender: socket.user.name,
        text: message,
      });
    });

    socket.on("disconnect", async () => {
      console.log(`❌ ${socket.user.name} disconnected`);
      try {
        await Room.updateMany(
          { users: socket.user.id },
          { $pull: { users: socket.user.id } }
        );
        socket.rooms.forEach(roomId => {
          if (roomId !== socket.id) {
            io.to(roomId).emit("systemMessage", `${socket.user.name} left the room`);
          }
        });
      } catch (err) {
        console.error("Error removing user from rooms:", err);
      }
    });
  });
};
