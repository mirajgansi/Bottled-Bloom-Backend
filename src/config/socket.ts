import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "./index";
let io: Server;
const onlineUsers = new Map<string, string>();
function extractTokenFromCookieHeader(cookieHeader?: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("auth_token="));
  if (!match) return null;
  return decodeURIComponent(match.split("=")[1]);
}

export const initSocket = (server: any) => {
  io = new Server(server, {
    cors: {
      origin: ["http://localhost:3000", "http://localhost:3003"],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token = extractTokenFromCookieHeader(
        socket.handshake.headers.cookie,
      );
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
