import request from "supertest";
import mongoose from "mongoose";
import path from "path";
import app from "../../app";
import fs from "fs";
import { UserModel } from "../../models/user.model";

describe("Admin Users Integration Tests", () => {
  const adminEmail = "admin@test.com";
  const adminPassword = "AdminPass123!";
  const adminUsername = "admin-user";

  let adminToken = "";
  let createdUserId = "";

  // where your admin router is mounted:
  // change this if your app uses a different mount path
  const ADMIN_BASE = "/api/admin/users";

  beforeAll(async () => {
    // cleanup
    await UserModel.deleteMany({
      email: { $in: [adminEmail, "u-create@test.com", "u-update@test.com"] },
    });
    await UserModel.deleteMany({
      username: {
        $in: [adminUsername, "user-created", "user-updated", "normal-user"],
      },
    });

    // Create an admin user directly in DB (fastest & reliable for admin tests)
    // If your register route supports role only for admin-created, not public,
    // we set role by DB.
    const bcrypt = await import("bcryptjs");
    const hashed = await bcrypt.default.hash(adminPassword, 10);

    await UserModel.create({
      email: adminEmail,
      username: adminUsername,
      password: hashed,
      role: "admin",
    });

    // login admin to get token
    const loginRes = await request(app).post("/api/auth/login").send({
      email: adminEmail,
      password: adminPassword,
    });

    expect(loginRes.status).toBe(200);
    adminToken = loginRes.body.token;
    expect(adminToken).toBeTruthy();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await UserModel.deleteMany({
        email: { $in: [adminEmail, "u-create@test.com", "u-update@test.com"] },
      });
      await UserModel.deleteMany({
        username: { $in: [adminUsername, "user-created", "user-updated"] },
      });
    }
  });

  test("should reject admin routes without token", async () => {
    const res = await request(app).get(ADMIN_BASE);
    expect([401, 403]).toContain(res.status);
    expect(res.body).toHaveProperty("message");
  });

  test("should reject admin routes with non-admin token", async () => {
    // create normal user
    await request(app).post("/api/auth/register").send({
      username: "normal-user",
      email: "u-update@test.com",
      password: "password123",
      confirmPassword: "password123",
    });

    const loginRes = await request(app).post("/api/auth/login").send({
      email: "u-update@test.com",
      password: "password123",
    });

    const userToken = loginRes.body.token;

    const res = await request(app)
      .get(ADMIN_BASE)
      .set("Authorization", `Bearer ${userToken}`);

    expect([401, 403]).toContain(res.status);
    expect(res.body).toHaveProperty("message");
  });
  test("POST / (admin) should create a user (no image)", async () => {
    const res = await request(app)
      .post(ADMIN_BASE)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        username: "user-created",
        email: "u-create@test.com",
        password: "password123",
        confirmPassword: "password123",
        role: "user", // if your DTO allows role
      });

    // your controller might use 201
    expect([200, 201]).toContain(res.status);
    expect(res.body).toHaveProperty("message");
    expect(res.body).toHaveProperty("data");

    createdUserId = res.body.data?._id || res.body.data?.id;
    expect(createdUserId).toBeTruthy();
  });

  test("GET / (admin) should list users", async () => {
    const res = await request(app)
      .get(ADMIN_BASE)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");

    // many APIs return { data: users, pagination } OR { users, pagination }
    // accept either:
    const maybeUsers = res.body.data?.users ?? res.body.data ?? res.body.users;
    expect(Array.isArray(maybeUsers)).toBe(true);
  });

  test("GET /:id (admin) should get user by id", async () => {
    const res = await request(app)
      .get(`${ADMIN_BASE}/${createdUserId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("email", "u-create@test.com");
  });

  test("PUT /:id (admin) should update user (with image)", async () => {
    // generate tiny png
    const assetsDir = path.join(__dirname, "..", "assets");
    const imagePath = path.join(assetsDir, "admin-test.png");
    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X9lS8AAAAASUVORK5CYII=";
    fs.writeFileSync(imagePath, Buffer.from(pngBase64, "base64"));

    const res = await request(app)
      .put(`${ADMIN_BASE}/${createdUserId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("username", "user-updated")
      .attach("image", imagePath, {
        filename: "admin-test.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("username", "user-updated");
    expect(res.body.data).toHaveProperty("image");
  });

  test("DELETE /:id (admin) should delete user", async () => {
    const res = await request(app)
      .delete(`${ADMIN_BASE}/${createdUserId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");

    const inDb = await UserModel.findById(createdUserId).lean();
    expect(inDb).toBeNull();
  });
});
