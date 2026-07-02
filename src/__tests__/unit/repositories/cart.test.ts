import { CartRepository } from "../../../repositories/cart.repository";
import { CartModel } from "../../../models/cart.model";

jest.mock("../../../models/cart.model", () => ({
  CartModel: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
}));

describe("CartRepository (unit)", () => {
  let repo: CartRepository;

  beforeEach(() => {
    repo = new CartRepository();
    jest.clearAllMocks();
  });

  // -------------------------
  // getCartByUserId
  // -------------------------
  it("getCartByUserId should call findOne + populate", async () => {
    const populateMock = jest.fn().mockResolvedValue({ _id: "c1" });

    (CartModel.findOne as jest.Mock).mockReturnValue({
      populate: populateMock,
    });

    const res = await repo.getCartByUserId("u1");

    expect(CartModel.findOne).toHaveBeenCalledWith({ userId: "u1" });
    expect(populateMock).toHaveBeenCalledWith("items.productId");
    expect(res).toEqual({ _id: "c1" });
  });

  // -------------------------
  // createCartForUser
  // -------------------------
  it("createCartForUser should create empty cart", async () => {
    (CartModel.create as jest.Mock).mockResolvedValue({ _id: "c1" });

    const res = await repo.createCartForUser("u1");

    expect(CartModel.create).toHaveBeenCalledWith({
      userId: "u1",
      items: [],
    });

    expect(res).toEqual({ _id: "c1" });
  });

  // -------------------------
  // getOrCreateCart
  // -------------------------
  it("getOrCreateCart should return existing cart", async () => {
    const existing = { _id: "c1" };

    (CartModel.findOne as jest.Mock).mockResolvedValue(existing);

    const res = await repo.getOrCreateCart("u1");

    expect(res).toBe(existing);
    expect(CartModel.create).not.toHaveBeenCalled();
  });

  it("getOrCreateCart should create cart if not found", async () => {
    const newCart = { _id: "c2", items: [] };

    (CartModel.findOne as jest.Mock).mockResolvedValue(null);
    (CartModel.create as jest.Mock).mockResolvedValue(newCart);

    const res = await repo.getOrCreateCart("u1");

    expect(CartModel.create).toHaveBeenCalledWith({
      userId: "u1",
      items: [],
    });

    expect(res).toBe(newCart);
  });

  // -------------------------
  // addItem
  // -------------------------
  it("addItem should increase quantity if product exists", async () => {
    const saveMock = jest.fn().mockResolvedValue(true);

    const cart: any = {
      items: [{ productId: "p1", quantity: 2 }],
      save: saveMock,
    };

    jest.spyOn(repo, "getOrCreateCart").mockResolvedValue(cart);

    await repo.addItem("u1", "p1", 3);

    expect(cart.items[0].quantity).toBe(5);
    expect(saveMock).toHaveBeenCalled();
  });

  it("addItem should push new item if product not exists", async () => {
    const saveMock = jest.fn().mockResolvedValue(true);

    const cart: any = {
      items: [],
      save: saveMock,
    };

    jest.spyOn(repo, "getOrCreateCart").mockResolvedValue(cart);

    await repo.addItem("u1", "p1", 2);

    expect(cart.items.length).toBe(1);
    expect(cart.items[0]).toEqual({
      productId: "p1",
      quantity: 2,
    });
    expect(saveMock).toHaveBeenCalled();
  });

  // -------------------------
  // updateQuantity
  // -------------------------
  it("updateQuantity should update quantity if item exists", async () => {
    const saveMock = jest.fn().mockResolvedValue(true);

    const cart: any = {
      items: [{ productId: "p1", quantity: 2 }],
      save: saveMock,
    };

    jest.spyOn(repo, "getOrCreateCart").mockResolvedValue(cart);

    await repo.updateQuantity("u1", "p1", 5);

    expect(cart.items[0].quantity).toBe(5);
    expect(saveMock).toHaveBeenCalled();
  });

  it("updateQuantity should remove item if qty <= 0", async () => {
    const saveMock = jest.fn().mockResolvedValue(true);

    const cart: any = {
      items: [{ productId: "p1", quantity: 2 }],
      save: saveMock,
    };

    jest.spyOn(repo, "getOrCreateCart").mockResolvedValue(cart);

    await repo.updateQuantity("u1", "p1", 0);

    expect(cart.items.length).toBe(0);
    expect(saveMock).toHaveBeenCalled();
  });

  it("updateQuantity should return null if product not found", async () => {
    const cart: any = {
      items: [],
      save: jest.fn(),
    };

    jest.spyOn(repo, "getOrCreateCart").mockResolvedValue(cart);

    const res = await repo.updateQuantity("u1", "p1", 5);

    expect(res).toBeNull();
  });

  // -------------------------
  // removeItem
  // -------------------------
  it("removeItem should remove item if exists", async () => {
    const saveMock = jest.fn().mockResolvedValue(true);

    const cart: any = {
      items: [{ productId: "p1", quantity: 1 }],
      save: saveMock,
    };

    jest.spyOn(repo, "getOrCreateCart").mockResolvedValue(cart);

    await repo.removeItem("u1", "p1");

    expect(cart.items.length).toBe(0);
    expect(saveMock).toHaveBeenCalled();
  });

  // -------------------------
  // clearCart
  // -------------------------
  it("clearCart should remove all items", async () => {
    const saveMock = jest.fn().mockResolvedValue(true);

    const cart: any = {
      items: [
        { productId: "p1", quantity: 1 },
        { productId: "p2", quantity: 2 },
      ],
      save: saveMock,
    };

    jest.spyOn(repo, "getOrCreateCart").mockResolvedValue(cart);

    await repo.clearCart("u1");

    expect(cart.items.length).toBe(0);
    expect(saveMock).toHaveBeenCalled();
  });
});
