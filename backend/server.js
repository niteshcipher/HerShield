// backend/server.js
import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.route.js";
import { geminiRoutes } from "./routes/geminiRoutes.js";
import { connectDB } from "./lib/db.js";

// Setup __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/gemini", geminiRoutes); // Add geminiRoutes middleware

// HTTP + Socket setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// Track connected users
const connectedUsers = new Map();

// Socket.io logic
io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // 🛰 Real-time location sharing
  socket.on("send-location", (data) => {
    connectedUsers.set(socket.id, { id: socket.id, ...data });
    io.emit("receive-location", { id: socket.id, ...data });
  });

  // 🚨 SOS Alert: one user triggers, all others get notified
  socket.on("sos-alert", ({ latitude, longitude }) => {
    console.log(`SOS triggered by ${socket.id} at [${latitude}, ${longitude}]`);

    // Send to everyone except sender
    socket.broadcast.emit("incoming-sos", {
      from: socket.id,
      latitude,
      longitude,
    });
  });

  // 🔌 User disconnect
  socket.on("disconnect", () => {
    connectedUsers.delete(socket.id);
    io.emit("user-disconnected", socket.id);
    console.log("User disconnected:", socket.id);
  });
});

// Serve frontend in production
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "/frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
  });
}

// Start server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  connectDB();
});