import { CartController } from "../../../controllers/cart.controller";
import { CartService } from "../../../services/cart.service";
import { AddToCartDto, UpdateCartItemDto } from "../../../dtos/cart.dto";
import { HttpError } from "../../../errors/http-error";

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}
function mockReq(overrides: any = {}) {
  return { body: {}, params: {}, query: {}, ...overrides } as any;
}

describe("CartController", () => {
  let controller: CartController;

  let getMyCartSpy: jest.SpyInstance;
  let addToCartSpy: jest.SpyInstance;
  let changeQuantitySpy: jest.SpyInstance;
  let removeFromCartSpy: jest.SpyInstance;
  let clearMyCartSpy: jest.SpyInstance;

  beforeEach(() => {
    controller = new CartController();

    getMyCartSpy = jest.spyOn(CartService.prototype as any, "getMyCart");
    addToCartSpy = jest.spyOn(CartService.prototype as any, "addToCart");
    changeQuantitySpy = jest.spyOn(
      CartService.prototype as any,
      "changeQuantity",
    );
    removeFromCartSpy = jest.spyOn(
      CartService.prototype as any,
      "removeFromCart",
    );
    clearMyCartSpy = jest.spyOn(CartService.prototype as any, "clearMyCart");
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // helper: your getUserId reads userId OR user.id OR user._id
  const reqWithUser = (id = "u1") => mockReq({ user: { id } });

  describe("getMyCart", () => {
    it("200 returns cart", async () => {
      const req = reqWithUser("u1");
      const res = mockRes();

      getMyCartSpy.mockResolvedValue({ items: [] });

      await controller.getMyCart(req as any, res as any);

      expect(getMyCartSpy).toHaveBeenCalledWith("u1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { items: [] },
      });
    });

    it("throws 401 if no user id", async () => {
      const req = mockReq({}); // no user info
      const res = mockRes();

      await expect(
        controller.getMyCart(req as any, res as any),
      ).rejects.toBeInstanceOf(HttpError);
      await expect(
        controller.getMyCart(req as any, res as any),
      ).rejects.toMatchObject({
        statusCode: 401,
      });
    });
  });

  describe("addItem", () => {
    it("200 adds item (happy path)", async () => {
      const req = reqWithUser("u1");
      req.body = { productId: "p1", quantity: 2 };
      const res = mockRes();

      // ✅ force DTO validation to pass
      jest.spyOn(AddToCartDto, "safeParse").mockReturnValue({
        success: true,
        data: { productId: "p1", quantity: 2 },
      } as any);

      addToCartSpy.mockResolvedValue({
        items: [{ productId: "p1", quantity: 2 }],
      });

      await controller.addItem(req as any, res as any);

      expect(addToCartSpy).toHaveBeenCalledWith("u1", "p1", 2);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: "Added to cart" }),
      );
    });

    it("throws 400 when DTO validation fails", async () => {
      const req = reqWithUser("u1");
      req.body = {};
      const res = mockRes();

      jest.spyOn(AddToCartDto, "safeParse").mockReturnValue({
        success: false,
        error: { issues: [{ message: "Invalid input" }] },
      } as any);

      await expect(
        controller.addItem(req as any, res as any),
      ).rejects.toMatchObject({
        statusCode: 400,
      });

      expect(addToCartSpy).not.toHaveBeenCalled();
    });
  });

  describe("updateItemQuantity", () => {
    it("400 if productId param missing", async () => {
      const req = reqWithUser("u1");
      req.params = {}; // no productId
      const res = mockRes();

      await expect(
        controller.updateItemQuantity(req as any, res as any),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(changeQuantitySpy).not.toHaveBeenCalled();
    });

    it("throws 400 when DTO validation fails", async () => {
      const req = reqWithUser("u1");
      req.params = { productId: "p1" };
      req.body = {};
      const res = mockRes();

      jest.spyOn(UpdateCartItemDto, "safeParse").mockReturnValue({
        success: false,
        error: { issues: [{ message: "Invalid quantity" }] },
      } as any);

      await expect(
        controller.updateItemQuantity(req as any, res as any),
      ).rejects.toMatchObject({ statusCode: 400 });

      expect(changeQuantitySpy).not.toHaveBeenCalled();
    });

    it("200 updates quantity", async () => {
      const req = reqWithUser("u1");
      req.params = { productId: "p1" };
      req.body = { quantity: 5 };
      const res = mockRes();

      jest.spyOn(UpdateCartItemDto, "safeParse").mockReturnValue({
        success: true,
        data: { quantity: 5 },
      } as any);

      changeQuantitySpy.mockResolvedValue({
        items: [{ productId: "p1", quantity: 5 }],
      });

      await controller.updateItemQuantity(req as any, res as any);

      expect(changeQuantitySpy).toHaveBeenCalledWith("u1", "p1", 5);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Cart item updated",
        }),
      );
    });
  });

  describe("removeItem", () => {
    it("400 if productId param missing", async () => {
      const req = reqWithUser("u1");
      req.params = {};
      const res = mockRes();

      await expect(
        controller.removeItem(req as any, res as any),
      ).rejects.toMatchObject({
        statusCode: 400,
      });

      expect(removeFromCartSpy).not.toHaveBeenCalled();
    });

    it("200 removes item", async () => {
      const req = reqWithUser("u1");
      req.params = { productId: "p1" };
      const res = mockRes();

      removeFromCartSpy.mockResolvedValue({ items: [] });

      await controller.removeItem(req as any, res as any);

      expect(removeFromCartSpy).toHaveBeenCalledWith("u1", "p1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Removed from cart",
        }),
      );
    });
  });

  describe("clearCart", () => {
    it("200 clears cart", async () => {
      const req = reqWithUser("u1");
      const res = mockRes();

      clearMyCartSpy.mockResolvedValue({ items: [] });

      await controller.clearCart(req as any, res as any);

      expect(clearMyCartSpy).toHaveBeenCalledWith("u1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, message: "Cart cleared" }),
      );
    });
  });
});
