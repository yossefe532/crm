import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { prisma } from "./prisma/client";

let io: Server;

export const initSocket = (httpServer: HttpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: "*", 
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.handshake.query.userId as string;
    const tenantId = socket.handshake.query.tenantId as string;

    if (userId && tenantId) {
      // Join rooms
      socket.join(`tenant:${tenantId}`);
      socket.join(`user:${userId}`);

      // Update status to online
      await prisma.user.update({
        where: { id: userId },
        data: { isOnline: true, lastSeen: null }
      }).catch(() => {}); // Ignore errors if user not found

      // Broadcast online status
      socket.to(`tenant:${tenantId}`).emit("user:status", { userId, isOnline: true });

      socket.on("disconnect", async () => {
        // Update status to offline
        const now = new Date();
        await prisma.user.update({
          where: { id: userId },
          data: { isOnline: false, lastSeen: now }
        }).catch(() => {});

        // Broadcast offline status
        socket.to(`tenant:${tenantId}`).emit("user:status", { userId, isOnline: false, lastSeen: now });
      });
    }

    // Join conversation room
    socket.on("join_conversation", (conversationId) => {
      if (conversationId) socket.join(`conversation:${conversationId}`);
    });
    
    // Leave conversation room
    socket.on("leave_conversation", (conversationId) => {
      if (conversationId) socket.leave(`conversation:${conversationId}`);
    });

    // Typing indicators
    socket.on("typing", ({ conversationId, userId: typerId }) => {
      socket.to(`conversation:${conversationId}`).emit("typing", { conversationId, userId: typerId });
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
