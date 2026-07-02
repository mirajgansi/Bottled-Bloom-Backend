import request from "supertest";
import mongoose from "mongoose";

jest.mock("../../services/notification.service", () => {
  return {
    NotificationService: jest.fn().mockImplementation(() => ({
      notify: jest.fn().mockResolvedValue(true),
    })),
  };
});

import app from "../../app";
import { UserModel } from "../../models/user.model";
import { ProductModel } from "../../models/product.model";
import { CartModel } from "../../models/cart.model";
import { OrderModel } from "../../models/order.model";

const testUser = {
  username: "order-user",
  email: "order@test.com",
  password: "password123",
  confirmPassword: "password123",
};

let createdProductId: string | null = null;
let createdOrderId: string | null = null;

beforeAll(async () => {
  await UserModel.deleteMany({ email: testUser.email });
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await UserModel.deleteMany({ email: testUser.email });

    if (createdOrderId) {
      await OrderModel.deleteOne({ _id: createdOrderId });
    }

    if (createdProductId) {
      await ProductModel.deleteOne({ _id: createdProductId });
    }

    const u = await UserModel.findOne({ email: testUser.email });
    if (u) {
      await CartModel.deleteMany({ userId: u._id });
      await OrderModel.deleteMany({ userId: u._id });
    }
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});

describe("Order Integration Test", () => {
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

  test("setup: ensure product exists (create if empty)", async () => {
    const listRes = await request(app).get("/api/products");
    expect(listRes.status).toBe(200);

    const products = Array.isArray(listRes.body.data)
      ? listRes.body.data
      : listRes.body.data?.products;

    if (!products || products.length === 0) {
      const p = await ProductModel.create({
        name: "Test Product - Order",
        description: "Created by order integration test",
        price: 100,
        category: "test",
        image: "test.png",
        images: ["test.png"],
        manufacturer: "Test Manufacturer",
        manufactureDate: "2026-01-01",
        expireDate: "2027-01-01",
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

  test("setup: add item to cart", async () => {
    const res = await request(app)
      .post("/api/cart/items")
      .set("Authorization", `Bearer ${token}`)
      .send({ productId, quantity: 2 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
  });

  test("POST /api/orders -> should create order from cart (201)", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${token}`)
      .send({
        shippingFee: 0,
        shippingAddress: {
          userName: "Test User",
          phone: "9800000000",
          address1: "Test Address",
          city: "Kathmandu",
          country: "Nepal",
        },
        notes: "test order",
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("message", "Order created");
    expect(res.body.data).toHaveProperty("_id");

    createdOrderId = String(res.body.data._id);
  });

  test("GET /api/orders/me -> should return my orders", async () => {
    const res = await request(app)
      .get("/api/orders/me")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(Array.isArray(res.body.data)).toBe(true);

    const ids = res.body.data.map((o: any) => String(o._id));
    expect(ids).toContain(createdOrderId);
  });

  test("GET /api/orders/:id -> should return the order", async () => {
    const res = await request(app)
      .get(`/api/orders/${createdOrderId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(String(res.body.data._id)).toBe(createdOrderId);
  });

  test("after order: cart should be cleared", async () => {
    const res = await request(app)
      .get("/api/cart")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);

    const cart = res.body.data;
    expect(Array.isArray(cart.items)).toBe(true);
    expect(cart.items.length).toBe(0);
  });

  test("PUT /api/orders/:id/cancel -> should cancel my order", async () => {
    const res = await request(app)
      .put(`/api/orders/${createdOrderId}/cancel`)
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("message", "Order cancelled");
    expect(res.body.data).toHaveProperty("status", "cancelled");
  });
});
