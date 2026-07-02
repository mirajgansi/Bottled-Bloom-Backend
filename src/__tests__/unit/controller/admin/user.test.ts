import { AdminUserController } from "../../../../controllers/admin/user.controller";
import { CreateUserDTO } from "../../../../dtos/user.dto";
import { AdminUserService } from "../../../../services/admin/user.service";

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
function mockReq(overrides: any = {}) {
  return { body: {}, params: {}, query: {}, ...overrides } as any;
}

describe("AdminUserController", () => {
  let controller: AdminUserController;

  let createUserSpy: jest.SpyInstance;
  let getAllUsersSpy: jest.SpyInstance;
  let updateUserSpy: jest.SpyInstance;
  let deleteUserSpy: jest.SpyInstance;
  let getUserByIdSpy: jest.SpyInstance;

  beforeEach(() => {
    controller = new AdminUserController();

    createUserSpy = jest.spyOn(AdminUserService.prototype as any, "createUser");
    getAllUsersSpy = jest.spyOn(
      AdminUserService.prototype as any,
      "getAllUsers",
    );
    updateUserSpy = jest.spyOn(AdminUserService.prototype as any, "updateUser");
    deleteUserSpy = jest.spyOn(AdminUserService.prototype as any, "deleteUser");
    getUserByIdSpy = jest.spyOn(
      AdminUserService.prototype as any,
      "getUserById",
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("createUser -> 201", async () => {
    const req = mockReq({
      body: { name: "A", email: "a@b.com", password: "Pass1234" },
    });
    const res = mockRes();
    const next = jest.fn();

    // ✅ Force CreateUserDTO validation to succeed
    jest.spyOn(CreateUserDTO, "safeParse").mockReturnValue({
      success: true,
      data: req.body,
    } as any);

    createUserSpy.mockResolvedValue({ _id: "u1", email: "a@b.com" });

    await controller.createUser(req, res, next);

    expect(createUserSpy).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: "User Created" }),
    );
  });

  it("getAllUsers -> passes role into filter", async () => {
    const req = mockReq({
      query: { page: "1", size: "10", search: "mi", role: "user" },
    });
    const res = mockRes();
    const next = jest.fn();

    getAllUsersSpy.mockResolvedValue({ items: [{ _id: "u1" }], total: 1 });

    await controller.getAllUsers(req, res, next);

    expect(getAllUsersSpy).toHaveBeenCalledWith({
      page: "1",
      size: "10",
      search: "mi",
      filter: { role: "user" },
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("updateUser -> 200", async () => {
    const req = mockReq({
      params: { id: "u1" },
      body: { name: "NewName" },
    });
    const res = mockRes();
    const next = jest.fn();

    updateUserSpy.mockResolvedValue({ _id: "u1", name: "NewName" });

    await controller.updateUser(req, res, next);

    expect(updateUserSpy).toHaveBeenCalledWith("u1", expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("deleteUser -> 404 if not deleted", async () => {
    const req = mockReq({ params: { id: "u1" } });
    const res = mockRes();

    deleteUserSpy.mockResolvedValue(null);

    await controller.deleteUser(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("getUserById -> 200", async () => {
    const req = mockReq({ params: { id: "u1" } });
    const res = mockRes();
    const next = jest.fn();

    getUserByIdSpy.mockResolvedValue({ _id: "u1", email: "a@b.com" });

    await controller.getUserById(req, res, next);

    expect(getUserByIdSpy).toHaveBeenCalledWith("u1");
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
