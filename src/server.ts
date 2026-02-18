console.log("Initializing server...");
import { createApp } from "./app";
import { startJobs } from "./jobs";

try {
  const app = createApp();

  // شغّل السيرفر على بورت 4000
  const PORT = 4000;

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // شغّل أي jobs بعد ما السيرفر يبدأ
    startJobs();
  });
} catch (error) {
  console.error("Failed to start server:", error);
}
