import { UserModel } from "../../../models/user.model";
import { UserRepository } from "../../../repositories/user.repository";

jest.mock("../../../models/user.model", () => ({
  UserModel: {
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    countDocuments: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  },
}));

describe("UserRepository (unit)", () => {
  let repo: UserRepository;

  beforeEach(() => {
    repo = new UserRepository();
    jest.clearAllMocks();
  });

  it("getUserByEmail should call findOne with email and return user", async () => {
    const fakeUser: any = { _id: "1", email: "a@b.com" };
    (UserModel.findOne as jest.Mock).mockResolvedValue(fakeUser);

    const res = await repo.getUserByEmail("a@b.com");

    expect(UserModel.findOne).toHaveBeenCalledWith({ email: "a@b.com" });
    expect(res).toBe(fakeUser);
  });

  it("getUserByUsername should call findOne with username", async () => {
    const fakeUser: any = { _id: "1", username: "miraj" };
    (UserModel.findOne as jest.Mock).mockResolvedValue(fakeUser);

    const res = await repo.getUserByUsername("miraj");

    expect(UserModel.findOne).toHaveBeenCalledWith({ username: "miraj" });
    expect(res).toBe(fakeUser);
  });

  it("getUserById should call findById", async () => {
    const fakeUser: any = { _id: "abc" };
    (UserModel.findById as jest.Mock).mockResolvedValue(fakeUser);

    const res = await repo.getUserById("abc");

    expect(UserModel.findById).toHaveBeenCalledWith("abc");
    expect(res).toBe(fakeUser);
  });

  it("getAllUsers should build search query and return users + total", async () => {
    // mock chained query: find().select().skip().limit()
    const limitMock = jest.fn().mockResolvedValue([{ _id: "1" }]);
    const skipMock = jest.fn().mockReturnValue({ limit: limitMock });
    const selectMock = jest.fn().mockReturnValue({ skip: skipMock });

    (UserModel.find as jest.Mock).mockReturnValue({ select: selectMock });
    (UserModel.countDocuments as jest.Mock).mockResolvedValue(99);

    const res = await repo.getAllUsers({
      page: 2,
      size: 10,
      search: "mi",
      filter: { role: "user" },
    });

    // verify query shape
    expect(UserModel.find).toHaveBeenCalledWith({
      role: "user",
      $or: [
        { username: { $regex: "mi", $options: "i" } },
        { email: { $regex: "mi", $options: "i" } },
        { phoneNumber: { $regex: "mi", $options: "i" } },
        { location: { $regex: "mi", $options: "i" } },
      ],
    });

    expect(selectMock).toHaveBeenCalledWith(
      "email username role location phoneNumber DOB gender",
    );
    expect(skipMock).toHaveBeenCalledWith((2 - 1) * 10);
    expect(limitMock).toHaveBeenCalledWith(10);

    expect(UserModel.countDocuments).toHaveBeenCalled();
    expect(res).toEqual({ users: [{ _id: "1" }], total: 99 });
  });

  it("updateUser should call findByIdAndUpdate with new:true", async () => {
    const updated: any = { _id: "1", username: "new" };
    (UserModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(updated);

    const res = await repo.updateUser("1", { username: "new" } as any);

    expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "1",
      { username: "new" },
      { new: true },
    );
    expect(res).toBe(updated);
  });

  it("deleteUser should return true when findByIdAndDelete returns doc", async () => {
    (UserModel.findByIdAndDelete as jest.Mock).mockResolvedValue({ _id: "1" });

    const res = await repo.deleteUser("1");

    expect(UserModel.findByIdAndDelete).toHaveBeenCalledWith("1");
    expect(res).toBe(true);
  });

  it("deleteUser should return false when findByIdAndDelete returns null", async () => {
    (UserModel.findByIdAndDelete as jest.Mock).mockResolvedValue(null);

    const res = await repo.deleteUser("1");

    expect(res).toBe(false);
  });

  it("saveFcmToken should update user's fcmToken", async () => {
    const updated: any = { _id: "1", fcmToken: "tok" };
    (UserModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(updated);

    const res = await repo.saveFcmToken("1", "tok");

    expect(UserModel.findByIdAndUpdate).toHaveBeenCalledWith(
      "1",
      { fcmToken: "tok" },
      { new: true },
    );
    expect(res).toBe(updated);
  });
});
