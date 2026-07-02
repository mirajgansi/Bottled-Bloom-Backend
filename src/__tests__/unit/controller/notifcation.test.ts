const serviceMock = {
  notify: jest.fn(),
  listForUser: jest.fn(),
  markRead: jest.fn(),
  markAllRead: jest.fn(),
  unreadCount: jest.fn(),
};
jest.mock("../../../services/notification.service", () => ({
  NotificationService: jest.fn().mockImplementation(() => serviceMock),
}));

jest.mock("../../../dtos/notificatoin.dto", () => ({
  createNotificationDto: { parse: jest.fn() },
  listNotificationsQueryDto: { parse: jest.fn() },
  markAsReadDto: { parse: jest.fn() },
}));
import { NotificationController } from "../../../controllers/notifcaton.controller";
import {
  createNotificationDto,
  listNotificationsQueryDto,
  markAsReadDto,
} from "../../../dtos/notificatoin.dto";

type MockRes = {
  status: jest.Mock;
  json: jest.Mock;
};

function makeRes(): MockRes {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe("NotificationController (unit)", () => {
  let controller: NotificationController;

  beforeEach(() => {
    controller = new NotificationController();
    jest.clearAllMocks();
  });

  it("create -> should parse body, call service.notify, return 201", async () => {
    (createNotificationDto.parse as jest.Mock).mockReturnValue({
      to: "u2",
      type: "order",
      message: "hello",
    });

    serviceMock.notify.mockResolvedValue({ _id: "n1" });

    const req: any = { body: { to: "u2", type: "order", message: "hello" } };
    const res = makeRes();

    await controller.create(req, res as any);

    expect(createNotificationDto.parse).toHaveBeenCalledWith(req.body);
    expect(serviceMock.notify).toHaveBeenCalledWith({
      to: "u2",
      type: "order",
      message: "hello",
    });

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { _id: "n1" },
    });
  });

  it("myNotifications -> should parse query, call listForUser, return json", async () => {
    (listNotificationsQueryDto.parse as jest.Mock).mockReturnValue({
      page: 2,
      limit: 5,
      read: false,
    });

    serviceMock.listForUser.mockResolvedValue({
      items: [{ _id: "n1" }],
      total: 1,
      page: 2,
      limit: 5,
      totalPages: 1,
    });

    const req: any = { query: { page: "2", limit: "5" }, user: { id: "u1" } };
    const res = makeRes();

    await controller.myNotifications(req, res as any);

    expect(listNotificationsQueryDto.parse).toHaveBeenCalledWith(req.query);
    expect(serviceMock.listForUser).toHaveBeenCalledWith("u1", {
      page: 2,
      limit: 5,
      read: false,
    });

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      items: [{ _id: "n1" }],
      total: 1,
      page: 2,
      limit: 5,
      totalPages: 1,
    });
  });

  it("markRead -> should parse params id, call service.markRead, return json", async () => {
    (markAsReadDto.parse as jest.Mock).mockReturnValue({
      notificationId: "n1",
    });

    serviceMock.markRead.mockResolvedValue({ _id: "n1", read: true });

    const req: any = { params: { id: "n1" }, user: { id: "u1" } };
    const res = makeRes();

    await controller.markRead(req, res as any);

    expect(markAsReadDto.parse).toHaveBeenCalledWith({ notificationId: "n1" });
    expect(serviceMock.markRead).toHaveBeenCalledWith("u1", {
      notificationId: "n1",
    });

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { _id: "n1", read: true },
    });
  });

  it("markAllRead -> should call service.markAllRead, return json", async () => {
    serviceMock.markAllRead.mockResolvedValue({ modified: 3 });

    const req: any = { user: { id: "u1" } };
    const res = makeRes();

    await controller.markAllRead(req, res as any);

    expect(serviceMock.markAllRead).toHaveBeenCalledWith("u1");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: { modified: 3 },
    });
  });

  it("unreadCount -> should call service.unreadCount, return json", async () => {
    serviceMock.unreadCount.mockResolvedValue(7);

    const req: any = { user: { id: "u1" } };
    const res = makeRes();

    await controller.unreadCount(req, res as any);

    expect(serviceMock.unreadCount).toHaveBeenCalledWith("u1");
    expect(res.json).toHaveBeenCalledWith({ success: true, count: 7 });
  });
});
