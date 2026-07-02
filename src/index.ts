import http from "http";
import app from "./app";
import { PORT } from "./config";
import { initSocket } from "./config/socket";
import { connectDatabase } from "./database/mongodb";

async function startServer() {
  await connectDatabase();

  const server = http.createServer(app);
  initSocket(server);

  server.listen(PORT, () => {
    console.log(`Server running: http://localhost:${PORT}`);
  });
}

startServer();
