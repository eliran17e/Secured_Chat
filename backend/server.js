// server.js
const config = require("./config/config");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const authRoutes = require("./routes/authRoutes");
const roomsRouter = require("./routes/roomsRouter");
const chatSocket = require("./sockets/chatSocket");
const { createRecipeEmbeddings } = require("./utils/create_recipe_embeddings");
const connectDB = require("./db");
const cors = require("cors");
const jwt = require("jsonwebtoken");


const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: config.server.cors,
});

// Middleware
app.use(express.json());

// CORS configuration
app.use(cors({
  origin: config.server.cors.origin,
}));

// Routes
app.use("/auth", authRoutes);
app.use("/rooms", roomsRouter);

// --- Authenticate sockets ---
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error("No token provided"));

  try {
    const decoded = jwt.verify(token, config.auth.jwtSecret);
    socket.user = decoded; // attach user to socket
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

// --- Handle socket connections ---
chatSocket(io);

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await connectDB();
    await createRecipeEmbeddings();
    server.listen(config.server.port, config.server.host, () => {
      console.log(`Server is running at http://${config.server.host}:${config.server.port}`);
      console.log(`Environment: ${config.environment}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
  }
};

startServer();
