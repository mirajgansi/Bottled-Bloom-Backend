import request from "supertest";
import mongoose from "mongoose";
import app from "../../app";
import { UserModel } from "../../models/user.model";
import { ProductModel } from "../../models/product.model"; // ✅ add this

const PRODUCTS_URL = "/api/products";
const CART_BASE = "/api/cart";
const CART_ITEMS = `${CART_BASE}/items`;

const testUser = {
  username: "cart-user",
  email: "cart@test.com",
  password: "password123",
  confirmPassword: "password123",
};

let createdProductId: string | null = null;

beforeAll(async () => {
  await UserModel.deleteMany({ email: testUser.email });
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await UserModel.deleteMany({ email: testUser.email });

    // cleanup only if we created it
    if (createdProductId) {
      await ProductModel.deleteOne({ _id: createdProductId });
    }
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});

describe("Cart Integration Test (with real login)", () => {
  let token: string;
  let productId: string;

  test("setup: register + login", async () => {
    await request(app).post("/api/auth/register").send(testUser);

    const loginRes = await request(app).post("/api/auth/login").send({
      email: testUser.email,
      password: testUser.password,
    });

    expect(loginRes.status).toBe(200);

    token =
      loginRes.body.token ||
      loginRes.body.data?.token ||
      loginRes.body.accessToken ||
      loginRes.body.data?.accessToken;

    expect(token).toBeTruthy();
  });

  test("setup: get productId (create one if none exists)", async () => {
    const res = await request(app).get(PRODUCTS_URL);
    expect(res.status).toBe(200);

    const products = Array.isArray(res.body.data)
      ? res.body.data
      : res.body.data?.products;
    if (!products || products.length === 0) {
      const p = await ProductModel.create({
        name: "Test Product - Cart",
        description: "Created by cart integration test",
        price: 100,
        category: "test",
        image: "test.png",
        images: ["test.png"],
        manufacturer: "Test Manufacturer",
        manufactureDate: "2026-01-01", // string required
        expireDate: "2027-01-01", // string required
        nutritionalInfo: "N/A",
        inStock: 50,
      });

      createdProductId = String(p._id);
      productId = createdProductId;
    } else {
      productId = String(products[0]._id || products[0].id);
    }

    expect(productId).toBeTruthy();
  });

  test("GET /api/cart -> 200", async () => {
    const res = await request(app)
      .get(CART_BASE)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
  });

  test("POST /api/cart/items -> 200 add item", async () => {
    const res = await request(app)
      .post(CART_ITEMS)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message", "Added to cart");
  });

  test("POST /api/cart/items -> 400 invalid body", async () => {
    const res = await request(app)
      .post(CART_ITEMS)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId: "", quantity: -1 });

    expect(res.status).toBe(400);
  });

  //   test("PATCH /api/cart/items/:productId -> 200 update quantity", async () => {
  //     // ensure item exists
  //     await request(app)
  //       .post(CART_ITEMS)
  //       .set("Authorization", `Bearer ${token}`)
  //       .send({ productId, quantity: 1 });

  //     const cartRes = await request(app)
  //       .get(CART_BASE)
  //       .set("Authorization", `Bearer ${token}`);

  //     const cart = cartRes.body.data;
  //     const item = cart.items?.[0];
  //     expect(item).toBeTruthy();

  //     // extract id from returned cart item
  //     const pid =
  //       typeof item.productId === "string"
  //         ? item.productId
  //         : String(item.productId?._id || item.productId?.id);

  //     const res = await request(app)
  //       .patch(`${CART_ITEMS}/${pid}`)
  //       .set("Authorization", `Bearer ${token}`)
  //       .send({ quantity: 5 });

  //     expect(res.status).toBe(200);
  //     expect(res.body).toHaveProperty("message", "Cart item updated");
  //   });

  test("DELETE /api/cart/items/:productId -> 200 remove item", async () => {
    const res = await request(app)
      .delete(`${CART_ITEMS}/${productId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message", "Removed from cart");
  });

  test("DELETE /api/cart -> 200 clear cart", async () => {
    await request(app)
      .post(CART_ITEMS)
      .set("Authorization", `Bearer ${token}`)
      .send({ productId, quantity: 1 });

    const res = await request(app)
      .delete(CART_BASE)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message", "Cart cleared");
  });
});
