/* eslint-disable @typescript-eslint/no-explicit-any */

import { NotificationRepository } from "../../../repositories/notification.repository";
import { UserRepository } from "../../../repositories/user.repository";

// ---- module mocks (top-level) ----
jest.mock("../../../repositories/notification.repository", () => ({
  NotificationRepository: jest.fn(),
}));

jest.mock("../../../repositories/user.repository", () => ({
  UserRepository: jest.fn(),
}));

jest.mock("../../../config/socket", () => ({
  getIO: jest.fn(),
  isUserOnline: jest.fn(),
}));

jest.mock("../../../utils/sendNotification", () => ({
  sendPushNotification: jest.fn(),
}));

describe("NotificationService", () => {
  let service: any;
  let repo: any;
  let userRepo: any;

  // socket mocks
  let io: any;
  let toObj: any;

  // IMPORTANT: we will set these from requireMock after resetModules
  let socketMock: any;
  let pushMock: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    repo = {
      findByUser: jest.fn(),
      create: jest.fn(),
      markRead: jest.fn(),
      markAllRead: jest.fn(),
      unreadCount: jest.fn(),
    };

    userRepo = {
      getUserById: jest.fn(),
    };

    // io.to(userId).emit(...)
    toObj = { emit: jest.fn() };
    io = { to: jest.fn(() => toObj) };

    // Wire repository constructors AFTER resetModules
    const notifRepoModule = jest.requireMock(
      "../../../repositories/notification.repository",
    );
    notifRepoModule.NotificationRepository.mockImplementation(() => repo);

    const userRepoModule = jest.requireMock(
      "../../../repositories/user.repository",
    );
    userRepoModule.UserRepository.mockImplementation(() => userRepo);

    // ✅ Get fresh mocked socket module + set behavior here
    socketMock = jest.requireMock("../../../config/socket");
    socketMock.getIO.mockReturnValue(io);
    socketMock.isUserOnline.mockReturnValue(false);

    // ✅ Get fresh mocked push module
    pushMock = jest.requireMock("../../../utils/sendNotification");
    pushMock.sendPushNotification.mockResolvedValue(true);

    // Now load the service
    const {
      NotificationService,
    } = require("../../../services/notification.service");
    service = new NotificationService();
  });

  // ---------------- listForUser ----------------
  describe("listForUser", () => {
    it("calls repo.findByUser with normalized query", async () => {
      repo.findByUser.mockResolvedValue({ items: [], total: 0 });

      const res = await service.listForUser("u1", {
        page: 2,
        limit: 10,
        read: true,
      });

      expect(repo.findByUser).toHaveBeenCalledWith("u1", {
        page: 2,
        limit: 10,
        read: true,
      });
      expect(res).toEqual({ items: [], total: 0 });
    });
  });

  // ---------------- notify ----------------
  describe("notify", () => {
    it("saves, emits socket event always", async () => {
      const saved = {
        _id: { toString: () => "n1" },
        to: { toString: () => "u1" },
        title: "Hello",
        message: "World",
        type: "notification",
      };

      repo.create.mockResolvedValue(saved);

      // user exists, token exists but ONLINE => no push
      userRepo.getUserById.mockResolvedValue({ _id: "u1", fcmToken: "tok" });
      socketMock.isUserOnline.mockReturnValue(true);

      const res = await service.notify({
        to: "u1",
        title: "Hello",
        message: "World",
        type: "notification",
      });

      expect(repo.create).toHaveBeenCalled();

      expect(socketMock.getIO).toHaveBeenCalled();
      expect(io.to).toHaveBeenCalledWith("u1");
      expect(toObj.emit).toHaveBeenCalledWith("notification", saved);

      expect(pushMock.sendPushNotification).not.toHaveBeenCalled();
      expect(res).toBe(saved);
    });

    it("when offline and token exists => sends push", async () => {
      const saved = {
        _id: { toString: () => "n1" },
        to: { toString: () => "u1" },
        title: "New",
        message: "Msg",
        type: "order_shipped",
      };

      repo.create.mockResolvedValue(saved);
      userRepo.getUserById.mockResolvedValue({ _id: "u1", fcmToken: "tok123" });

      socketMock.isUserOnline.mockReturnValue(false);

      await service.notify({
        to: "u1",
        title: "New",
        message: "Msg",
        type: "order_shipped",
      });

      expect(pushMock.sendPushNotification).toHaveBeenCalledWith(
        "tok123",
        "New",
        "Msg",
        expect.objectContaining({
          type: "order_shipped",
          notificationId: "n1",
        }),
      );
    });

    it("when offline but no token => does not send push", async () => {
      const saved = {
        _id: { toString: () => "n1" },
        to: { toString: () => "u1" },
        title: "A",
        message: "B",
        type: "notification",
      };

      repo.create.mockResolvedValue(saved);
      userRepo.getUserById.mockResolvedValue({
        _id: "u1",
        fcmToken: undefined,
      });

      socketMock.isUserOnline.mockReturnValue(false);

      await service.notify({ to: "u1", title: "A", message: "B" });

      expect(pushMock.sendPushNotification).not.toHaveBeenCalled();

      // socket still emits
      expect(io.to).toHaveBeenCalledWith("u1");
      expect(toObj.emit).toHaveBeenCalledWith("notification", saved);
    });

    it("offline + token + saved.type missing => defaults push payload type to 'notification'", async () => {
      const saved = {
        _id: { toString: () => "n1" },
        to: { toString: () => "u1" },
        title: "A",
        message: "B",
        type: undefined,
      };

      repo.create.mockResolvedValue(saved);
      userRepo.getUserById.mockResolvedValue({ _id: "u1", fcmToken: "tok" });

      socketMock.isUserOnline.mockReturnValue(false);

      await service.notify({ to: "u1", title: "A", message: "B" } as any);

      expect(pushMock.sendPushNotification).toHaveBeenCalledWith(
        "tok",
        "A",
        "B",
        expect.objectContaining({
          type: "notification",
          notificationId: "n1",
        }),
      );
    });
  });

  // ---------------- markRead ----------------
  describe("markRead", () => {
    it("throws Error if notification not found", async () => {
      repo.markRead.mockResolvedValue(null);

      await expect(
        service.markRead("u1", { notificationId: "n404" }),
      ).rejects.toThrow("Notification not found");

      expect(repo.markRead).toHaveBeenCalledWith("n404", "u1");
    });

    it("returns updated notification", async () => {
      const updated = { _id: "n1", read: true };
      repo.markRead.mockResolvedValue(updated);

      const res = await service.markRead("u1", { notificationId: "n1" });

      expect(repo.markRead).toHaveBeenCalledWith("n1", "u1");
      expect(res).toBe(updated);
    });
  });

  // ---------------- markAllRead ----------------
  describe("markAllRead", () => {
    it("calls repo.markAllRead", async () => {
      repo.markAllRead.mockResolvedValue({ modifiedCount: 3 });

      const res = await service.markAllRead("u1");

      expect(repo.markAllRead).toHaveBeenCalledWith("u1");
      expect(res).toEqual({ modifiedCount: 3 });
    });
  });

  // ---------------- unreadCount ----------------
  describe("unreadCount", () => {
    it("calls repo.unreadCount", async () => {
      repo.unreadCount.mockResolvedValue(7);

      const res = await service.unreadCount("u1");

      expect(repo.unreadCount).toHaveBeenCalledWith("u1");
      expect(res).toBe(7);
    });
  });
});
