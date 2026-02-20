"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
console.log("Initializing server...");
const app_1 = require("./app");
const jobs_1 = require("./jobs");
const http_1 = require("http");
const socket_1 = require("./socket");
try {
    const app = (0, app_1.createApp)();
    const httpServer = (0, http_1.createServer)(app);
    // Initialize Socket.IO
    (0, socket_1.initSocket)(httpServer);
    // شغّل السيرفر على بورت 4000 أو المتغير البيئي
    const PORT = process.env.PORT || 4000;
    httpServer.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
        // شغّل أي jobs بعد ما السيرفر يبدأ
        (0, jobs_1.startJobs)();
    });
}
catch (error) {
    console.error("Failed to start server:", error);
}
