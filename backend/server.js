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
import { connectDB } from "./lib/db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// API routes
app.use("/api/auth", authRoutes);

// HTTP and Socket.IO setup
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const connectedUsers = new Map();

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  socket.on("send-location", (data) => {
    connectedUsers.set(socket.id, { id: socket.id, ...data });
    io.emit("receive-location", { id: socket.id, ...data });
  });

  socket.on("disconnect", () => {
    connectedUsers.delete(socket.id);
    io.emit("user-disconnected", socket.id);
    console.log("User disconnected:", socket.id);
  });
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "/frontend/dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(__dirname, "frontend", "dist", "index.html"));
  });
}

server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  connectDB();
});
