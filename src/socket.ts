import { Server as HttpServer } from "http";
import { Server } from "socket.io";

let io: Server;

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*", // In production, restrict this to FRONTEND_URL
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    // console.log("Client connected:", socket.id);
    
    // Join tenant room for tenant-wide notifications
    socket.on("join_tenant", (tenantId) => {
      if (tenantId) socket.join(`tenant:${tenantId}`);
    });
    
    // Join user room for personal notifications
    socket.on("join_user", (userId) => {
      if (userId) socket.join(`user:${userId}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
};
