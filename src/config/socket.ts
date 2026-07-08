import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./index";

let io: Server;
const onlineUsers = new Map<string, string>();

export const initSocket = (server: any) => {
  io = new Server(server, {
    cors: {
      origin: ["http://localhost:3000", "http://localhost:3003"], // no "*", match your app.ts whitelist
      credentials: true,
    },
  });

  // Authenticate the socket at handshake time using the same JWT as HTTP requests
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("Unauthorized"));
      const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
      (socket as any).userId = decoded.id;
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = (socket as any).userId as string;

    // Auto-join the room derived from the verified token — client can no longer choose the room
    socket.join(userId);
    onlineUsers.set(userId, socket.id);

    socket.on("disconnect", () => {
      for (const [uid, sid] of onlineUsers.entries()) {
        if (sid === socket.id) onlineUsers.delete(uid);
      }
    });
  });

  return io;
};

export const getIO = () => io;
export const isUserOnline = (userId: string) => onlineUsers.has(userId);
