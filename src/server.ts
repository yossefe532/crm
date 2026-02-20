console.log("Initializing server...");
import { createApp } from "./app";
import { startJobs } from "./jobs";
import { createServer } from "http";
import { initSocket } from "./socket";

try {
  const app = createApp();
  const httpServer = createServer(app);
  
  // Initialize Socket.IO
  initSocket(httpServer);

  // شغّل السيرفر على بورت 4000 أو المتغير البيئي
  const PORT = process.env.PORT || 4000;

  httpServer.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // شغّل أي jobs بعد ما السيرفر يبدأ
    startJobs();
  });
} catch (error) {
  console.error("Failed to start server:", error);
}
