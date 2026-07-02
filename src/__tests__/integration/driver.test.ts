import request from "supertest";
import mongoose from "mongoose";

// ✅ mock notifications
jest.mock("../../services/notification.service", () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    notify: jest.fn().mockResolvedValue(true),
  })),
}));

import app from "../../app";
import { UserModel } from "../../models/user.model";
import { ProductModel } from "../../models/product.model";
import { OrderModel } from "../../models/order.model";
import { CartModel } from "../../models/cart.model";

const adminUser = {
  username: "admin-driver-test",
  email: "admin-driver@test.com",
  password: "password123",
  confirmPassword: "password123",
};

const driverUser = {
  username: "driver-test",
  email: "driver@test.com",
  password: "password123",
  confirmPassword: "password123",
};

const normalUser = {
  username: "user-test",
  email: "user@test.com",
  password: "password123",
  confirmPassword: "password123",
};

let createdProductId: string | null = null;

async function registerAndLogin(u: any) {
  await request(app).post("/api/auth/register").send(u);

  const loginRes = await request(app).post("/api/auth/login").send({
    email: u.email,
    password: u.password,
  });

  expect(loginRes.status).toBe(200);

  const token =
    loginRes.body.token ||
    loginRes.body.data?.token ||
    loginRes.body.accessToken ||
    loginRes.body.data?.accessToken;

  expect(token).toBeTruthy();
  return token as string;
}

beforeAll(async () => {
  await UserModel.deleteMany({
    email: { $in: [adminUser.email, driverUser.email, normalUser.email] },
  });
});

afterAll(async () => {
  if (mongoose.connection.readyState === 1) {
    await UserModel.deleteMany({
      email: { $in: [adminUser.email, driverUser.email, normalUser.email] },
    });

    if (createdProductId)
      await ProductModel.deleteOne({ _id: createdProductId });

    // cleanup orders/carts
    const u = await UserModel.findOne({ email: normalUser.email });
    if (u) {
      await CartModel.deleteMany({ userId: u._id });
      await OrderModel.deleteMany({ userId: u._id });
    }
  }

  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});

describe("Driver Integration Tests", () => {
  let adminToken: string;
  let driverToken: string;
  let userToken: string;

  let adminId: string;
  let driverId: string;
  let orderId: string;
  let productId: string;

  test("setup: register/login + force roles in DB", async () => {
    adminToken = await registerAndLogin(adminUser);
    driverToken = await registerAndLogin(driverUser);
    userToken = await registerAndLogin(normalUser);

    // ✅ force roles in DB (because register likely doesn't accept role)
    await UserModel.updateOne({ email: adminUser.email }, { role: "admin" });
    await UserModel.updateOne({ email: driverUser.email }, { role: "driver" });

    // re-fetch IDs
    const adminDoc = await UserModel.findOne({ email: adminUser.email });
    const driverDoc = await UserModel.findOne({ email: driverUser.email });

    expect(adminDoc).toBeTruthy();
    expect(driverDoc).toBeTruthy();

    adminId = String(adminDoc!._id);
    driverId = String(driverDoc!._id);

    // IMPORTANT: you must re-login after role update if JWT includes role
    // safest: login again to get fresh token with updated role
    adminToken = await registerAndLogin(adminUser);
    driverToken = await registerAndLogin(driverUser);
  });

  test("setup: ensure product exists", async () => {
    const listRes = await request(app).get("/api/products");
    expect(listRes.status).toBe(200);

    const products = Array.isArray(listRes.body.data)
      ? listRes.body.data
      : listRes.body.data?.products;

    if (!products || products.length === 0) {
      const p = await ProductModel.create({
        name: "Test Product - Driver",
        description: "Created by driver integration test",
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

  test("user: add to cart + create order", async () => {
    const addRes = await request(app)
      .post("/api/cart/items")
      .set("Authorization", `Bearer ${userToken}`)
      .send({ productId, quantity: 1 });

    expect(addRes.status).toBe(200);

    const orderRes = await request(app)
      .post("/api/orders")
      .set("Authorization", `Bearer ${userToken}`)
      .send({
        shippingFee: 0,
        shippingAddress: { userName: "Test", phone: "9800000000" },
        notes: "driver test",
      });

    expect(orderRes.status).toBe(201);
    orderId = String(orderRes.body.data._id);
    expect(orderId).toBeTruthy();
  });

  test("admin: assign driver to order", async () => {
    const res = await request(app)
      .patch(`/api/orders/${orderId}/assign-driver`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ driverId });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("message", "Driver assigned");
    expect(String(res.body.data.driverId)).toBe(driverId);
  });

  test("driver: update order status (PATCH /api/orders/driver/:id/status) -> delivered", async () => {
    const res = await request(app)
      .patch(`/api/orders/driver/${orderId}/status`)
      .set("Authorization", `Bearer ${driverToken}`)
      .send({ status: "delivered" });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("message", "Order status updated");
    expect(res.body.data).toHaveProperty("status", "delivered");
    expect(res.body.data).toHaveProperty("paymentStatus", "paid");
  });

  test("driver stats: GET /api/driver/stats/:id", async () => {
    const res = await request(app)
      .get(`/api/driver/stats/${driverId}`)
      // if your route is protected, keep this. if not, it won’t hurt.
      .set("Authorization", `Bearer ${driverToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);

    // ✅ handle both response shapes:
    const stats = res.body?.data?.data ?? res.body?.data ?? res.body;

    expect(stats).toHaveProperty("totalAssigned");
    expect(stats).toHaveProperty("deliveredCount");

    // optional stronger checks
    expect(typeof stats.totalAssigned).toBe("number");
    expect(typeof stats.deliveredCount).toBe("number");
  });

  test("driver detail: GET /api/driver/:id/detail", async () => {
    const res = await request(app)
      .get(`/api/driver/${driverId}/detail`)
      .set("Authorization", `Bearer ${driverToken}`); // ✅ add this

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body.data).toHaveProperty("driver");
    expect(res.body.data).toHaveProperty("stats");
    expect(res.body.data).toHaveProperty("orders");
    expect(res.body.data).toHaveProperty("pagination");
  });
});
