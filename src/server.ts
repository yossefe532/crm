console.log("Initializing server...");
import { createApp } from "./app";
import { startJobs } from "./jobs";
import { createServer } from "http";
import { initSocket } from "./socket";
import { env } from "./config/env";

try {
  const app = createApp();
  const httpServer = createServer(app);
  
  // Initialize Socket.IO
  initSocket(httpServer);

  // شغّل السيرفر على بورت 4000 أو المتغير البيئي
  const PORT = process.env.PORT || 4000;

  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // شغّل أي jobs بعد ما السيرفر يبدأ (مع حراسة للبيئة)
    try {
      if (!env.databaseUrl) {
        console.warn("DATABASE_URL is not set. Background jobs will be skipped.");
      } else {
        startJobs();
      }
    } catch (jobErr) {
      console.error("Failed to start background jobs:", jobErr);
    }
  });
} catch (error) {
  console.error("Failed to start server:", error);
}

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Promise Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
