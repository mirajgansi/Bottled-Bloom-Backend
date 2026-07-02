import { Types } from "mongoose";
import {
  NotificationRepository,
  NotificationService,
} from "../../../repositories/notification.repository";
import { NotificationModel } from "../../../models/notification.model";

jest.mock("../../../models/notification.model", () => ({
  NotificationModel: {
    create: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findOneAndUpdate: jest.fn(),
    updateMany: jest.fn(),
  },
}));

describe("NotificationRepository (unit)", () => {
  let repo: NotificationRepository;

  beforeEach(() => {
    repo = new NotificationRepository();
    jest.clearAllMocks();
  });

  it("create should convert to/from to ObjectId and call NotificationModel.create", async () => {
    (NotificationModel.create as jest.Mock).mockResolvedValue({ _id: "n1" });

    const dto: any = {
      to: "507f1f77bcf86cd799439011",
      from: "507f1f77bcf86cd799439012",
      type: "order",
      message: "hello",
    };

    await repo.create(dto);

    const createArg = (NotificationModel.create as jest.Mock).mock.calls[0][0];

    expect(createArg.to).toBeInstanceOf(Types.ObjectId);
    expect(String(createArg.to)).toBe(dto.to);

    expect(createArg.from).toBeInstanceOf(Types.ObjectId);
    expect(String(createArg.from)).toBe(dto.from);

    expect(NotificationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "order",
        message: "hello",
      }),
    );
  });

  it("create should set from undefined when not provided", async () => {
    (NotificationModel.create as jest.Mock).mockResolvedValue({ _id: "n1" });

    const dto: any = {
      to: "507f1f77bcf86cd799439011",
      type: "order",
      message: "hello",
    };

    await repo.create(dto);

    const createArg = (NotificationModel.create as jest.Mock).mock.calls[0][0];
    expect(createArg.to).toBeInstanceOf(Types.ObjectId);
    expect(createArg.from).toBeUndefined();
  });

  it("findByUser should paginate, optionally filter read, and return meta", async () => {
    // mock chain: find().sort().skip().limit()
    const limitMock = jest.fn().mockResolvedValue([{ _id: "n1" }]);
    const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
    const sortMock = jest.fn().mockReturnValue({ skip: skipMock });

    (NotificationModel.find as jest.Mock).mockReturnValue({ sort: sortMock });
    (NotificationModel.countDocuments as jest.Mock).mockResolvedValue(11);

    const userId = "507f1f77bcf86cd799439011";
    const res = await repo.findByUser(userId, {
      page: 2,
      limit: 5,
      read: false,
    });

    // verify filter
    const filterArg = (NotificationModel.find as jest.Mock).mock.calls[0][0];
    expect(filterArg.to).toBeInstanceOf(Types.ObjectId);
    expect(String(filterArg.to)).toBe(userId);
    expect(filterArg.read).toBe(false);

    // verify pagination
    expect(sortMock).toHaveBeenCalledWith({ createdAt: -1 });
    expect(skipMock).toHaveBeenCalledWith((2 - 1) * 5);
    expect(limitMock).toHaveBeenCalledWith(5);

    expect(NotificationModel.countDocuments).toHaveBeenCalledWith(filterArg);

    expect(res).toEqual({
      items: [{ _id: "n1" }],
      total: 11,
      page: 2,
      limit: 5,
      totalPages: Math.ceil(11 / 5),
    });
  });

  it("findByUser should NOT include read in filter when opts.read is undefined", async () => {
    const limitMock = jest.fn().mockResolvedValue([]);
    const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
    const sortMock = jest.fn().mockReturnValue({ skip: skipMock });

    (NotificationModel.find as jest.Mock).mockReturnValue({ sort: sortMock });
    (NotificationModel.countDocuments as jest.Mock).mockResolvedValue(0);

    const userId = "507f1f77bcf86cd799439011";
    await repo.findByUser(userId, { page: 1, limit: 10 });

    const filterArg = (NotificationModel.find as jest.Mock).mock.calls[0][0];
    expect(filterArg).toHaveProperty("to");
    expect(filterArg).not.toHaveProperty("read");
  });

  it("markRead should call findOneAndUpdate with _id and to ObjectId filters", async () => {
    (NotificationModel.findOneAndUpdate as jest.Mock).mockResolvedValue({
      _id: "n1",
      read: true,
    });

    const notificationId = "507f1f77bcf86cd799439013";
    const userId = "507f1f77bcf86cd799439011";

    await repo.markRead(notificationId, userId);

    const [filter, update, options] = (
      NotificationModel.findOneAndUpdate as jest.Mock
    ).mock.calls[0];

    expect(filter._id).toBeInstanceOf(Types.ObjectId);
    expect(String(filter._id)).toBe(notificationId);

    expect(filter.to).toBeInstanceOf(Types.ObjectId);
    expect(String(filter.to)).toBe(userId);

    expect(update).toEqual({ $set: { read: true } });
    expect(options).toEqual({ new: true });
  });

  it("markAllRead should updateMany unread and return modifiedCount", async () => {
    (NotificationModel.updateMany as jest.Mock).mockResolvedValue({
      modifiedCount: 7,
    });

    const userId = "507f1f77bcf86cd799439011";
    const res = await repo.markAllRead(userId);

    const [filter, update] = (NotificationModel.updateMany as jest.Mock).mock
      .calls[0];

    expect(filter.to).toBeInstanceOf(Types.ObjectId);
    expect(String(filter.to)).toBe(userId);
    expect(filter.read).toBe(false);

    expect(update).toEqual({ $set: { read: true } });
    expect(res).toEqual({ modified: 7 });
  });

  it("unreadCount should count read:false for this user", async () => {
    (NotificationModel.countDocuments as jest.Mock).mockResolvedValue(3);

    const userId = "507f1f77bcf86cd799439011";
    const res = await repo.unreadCount(userId);

    const filter = (NotificationModel.countDocuments as jest.Mock).mock
      .calls[0][0];
    expect(filter.to).toBeInstanceOf(Types.ObjectId);
    expect(String(filter.to)).toBe(userId);
    expect(filter.read).toBe(false);

    expect(res).toBe(3);
  });
});

describe("NotificationService (unit)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("notify should call NotificationModel.create with dto as-is", async () => {
    const service = new NotificationService();
    (NotificationModel.create as jest.Mock).mockResolvedValue({ _id: "n1" });

    const dto: any = { to: "u1", type: "order", message: "hi" };
    await service.notify(dto);

    expect(NotificationModel.create).toHaveBeenCalledWith(dto);
  });
});
