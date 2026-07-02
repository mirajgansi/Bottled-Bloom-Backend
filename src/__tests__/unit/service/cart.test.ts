/* eslint-disable @typescript-eslint/no-explicit-any */

import { HttpError } from "../../../errors/http-error";

// mock CartRepository module (must be top-level)
jest.mock("../../../repositories/cart.repository", () => ({
  CartRepository: jest.fn(),
}));

describe("CartService", () => {
  let service: any;
  let repo: any;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    // repo instance used by module-scope `new CartRepository()`
    repo = {
      getCartByUserId: jest.fn(),
      createCartForUser: jest.fn(),
      addItem: jest.fn(),
      updateQuantity: jest.fn(),
      removeItem: jest.fn(),
      clearCart: jest.fn(),
    };

    // IMPORTANT: grab fresh mock after resetModules
    const repoModule = jest.requireMock(
      "../../../repositories/cart.repository",
    );
    repoModule.CartRepository.mockImplementation(() => repo);

    // now load service (it will create module-scope cartRepository using our repo)
    const { CartService } = require("../../../services/cart.service");
    service = new CartService();
  });

  // ---------------- getMyCart ----------------
  describe("getMyCart", () => {
    it("returns existing cart if found", async () => {
      const cart = { _id: "c1", userId: "u1", items: [] };
      repo.getCartByUserId.mockResolvedValue(cart);

      const res = await service.getMyCart("u1");

      expect(repo.getCartByUserId).toHaveBeenCalledWith("u1");
      expect(repo.createCartForUser).not.toHaveBeenCalled();
      expect(res).toBe(cart);
    });

    it("creates cart if not found", async () => {
      repo.getCartByUserId.mockResolvedValue(null);
      const created = { _id: "c1", userId: "u1", items: [] };
      repo.createCartForUser.mockResolvedValue(created);

      const res = await service.getMyCart("u1");

      expect(repo.getCartByUserId).toHaveBeenCalledWith("u1");
      expect(repo.createCartForUser).toHaveBeenCalledWith("u1");
      expect(res).toEqual(created);
    });
  });

  // ---------------- addToCart ----------------
  describe("addToCart", () => {
    it("throws 400 if quantity < 1", async () => {
      await expect(service.addToCart("u1", "p1", 0)).rejects.toMatchObject({
        statusCode: 400,
      });

      expect(repo.addItem).not.toHaveBeenCalled();
    });

    it("defaults quantity to 1", async () => {
      repo.addItem.mockResolvedValue({ ok: true });

      const res = await service.addToCart("u1", "p1");

      expect(repo.addItem).toHaveBeenCalledWith("u1", "p1", 1);
      expect(res).toEqual({ ok: true });
    });

    it("calls repository with provided quantity", async () => {
      repo.addItem.mockResolvedValue({ ok: true });

      const res = await service.addToCart("u1", "p1", 3);

      expect(repo.addItem).toHaveBeenCalledWith("u1", "p1", 3);
      expect(res).toEqual({ ok: true });
    });
  });

  // ---------------- changeQuantity ----------------
  describe("changeQuantity", () => {
    it("throws 404 if repository returns null", async () => {
      repo.updateQuantity.mockResolvedValue(null);

      await expect(service.changeQuantity("u1", "p1", 2)).rejects.toMatchObject(
        {
          statusCode: 404,
        },
      );

      expect(repo.updateQuantity).toHaveBeenCalledWith("u1", "p1", 2);
    });

    it("returns updated cart when ok", async () => {
      const updated = { _id: "c1", items: [{ productId: "p1", quantity: 2 }] };
      repo.updateQuantity.mockResolvedValue(updated);

      const res = await service.changeQuantity("u1", "p1", 2);

      expect(repo.updateQuantity).toHaveBeenCalledWith("u1", "p1", 2);
      expect(res).toBe(updated);
    });
  });

  // ---------------- removeFromCart ----------------
  describe("removeFromCart", () => {
    it("calls repository removeItem", async () => {
      repo.removeItem.mockResolvedValue({ ok: true });

      const res = await service.removeFromCart("u1", "p1");

      expect(repo.removeItem).toHaveBeenCalledWith("u1", "p1");
      expect(res).toEqual({ ok: true });
    });
  });

  // ---------------- clearMyCart ----------------
  describe("clearMyCart", () => {
    it("calls repository clearCart", async () => {
      repo.clearCart.mockResolvedValue({ ok: true });

      const res = await service.clearMyCart("u1");

      expect(repo.clearCart).toHaveBeenCalledWith("u1");
      expect(res).toEqual({ ok: true });
    });
  });
});
