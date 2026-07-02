import { Server } from "socket.io";

let io: Server;

// store online users
const onlineUsers = new Map<string, string>();
// userId -> socketId

export const initSocket = (server: any) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log("New socket connected:", socket.id);

    socket.on("join", (userId: string) => {
      console.log("User joined room:", userId);

      socket.join(userId);
      onlineUsers.set(userId, socket.id);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected:", socket.id);

      // remove user from online map
      for (const [uid, sid] of onlineUsers.entries()) {
        if (sid === socket.id) {
          onlineUsers.delete(uid);
          break;
        }
      }
    });
  });

  return io;
};

export const getIO = () => io;

export const isUserOnline = (userId: string) => onlineUsers.has(userId);
