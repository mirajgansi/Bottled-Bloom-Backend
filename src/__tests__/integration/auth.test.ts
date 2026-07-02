import request from "supertest";
import app from "../../app";
import { UserModel } from "../../models/user.model";
import mongoose from "mongoose";

const cleanupEmails = [
  "test@test.com",
  "mismatch@test.com",
  "dup@test.com",
  "u1@test.com",
  "u2@test.com",
  "login@test.com",
  "notfound@test.com",
];

const cleanupUsernames = [
  "test gansi",
  "dup-user",
  "dup-user-2",
  "unique-test",
  "testuser",
];

beforeAll(async () => {
  await UserModel.deleteMany({ email: { $in: cleanupEmails } });
  await UserModel.deleteMany({ username: { $in: cleanupUsernames } });
});

afterAll(async () => {
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  if (mongoose.connection.readyState === 1) {
    await UserModel.deleteMany({ email: { $in: cleanupEmails } });
    await UserModel.deleteMany({ username: { $in: cleanupUsernames } });
  }

  // close only if it's still open
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
});

describe("Authentication Integration Test - Register", () => {
  const baseUser = {
    username: "test gansi",
    email: "test@test.com",
    password: "password123",
    confirmPassword: "password123",
  };

  describe("POST /api/auth/register", () => {
    test("should register a new user", async () => {
      const res = await request(app).post("/api/auth/register").send(baseUser);
      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("message", "User Created");
    });

    test("should fail if confirmPassword does not match", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          ...baseUser,
          email: "mismatch@test.com",
          confirmPassword: "differentPassword",
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message");
    });

    test("should fail if email is invalid (missing @)", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          ...baseUser,
          email: "invalidEmail.com",
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("message");
    });

    test("should fail if email already exists", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({
          ...baseUser,
          email: "dup@test.com",
          username: "dup-user",
        });

      const res = await request(app)
        .post("/api/auth/register")
        .send({
          ...baseUser,
          email: "dup@test.com",
          username: "dup-user-2",
        });

      expect([400, 403, 409]).toContain(res.status);
      expect(res.body).toHaveProperty("message");
    });

    test("should fail if username already exists (if enforced)", async () => {
      await request(app)
        .post("/api/auth/register")
        .send({
          ...baseUser,
          email: "u1@test.com",
          username: "unique-test",
        });

      const res = await request(app)
        .post("/api/auth/register")
        .send({
          ...baseUser,
          email: "u2@test.com",
          username: "unique-test",
        });

      expect([400, 403, 409, 404]).toContain(res.status);
      expect(res.body).toHaveProperty("message");
    });
  });
});

describe("Authentication Integration Test - Login", () => {
  const user = {
    username: "testuser",
    email: "login@test.com",
    password: "password123",
    confirmPassword: "password123",
  };

  test("setup: register user for login tests", async () => {
    const res = await request(app).post("/api/auth/register").send(user);
    // Either it's created or already exists if test re-run
    expect([201, 400, 403, 409, 404]).toContain(res.status);
  });

  describe("POST /api/auth/login", () => {
    test("should login successfully with correct credentials", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: user.email,
        password: user.password,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("message");
      // if token exists:
      // expect(res.body).toHaveProperty("token");
    });

    test("should fail login with wrong password", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: user.email,
        password: "wrongpassword",
      });

      expect([400, 401, 403]).toContain(res.status);
      expect(res.body).toHaveProperty("message");
    });

    test("should fail login if email does not exist", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "notfound@test.com",
        password: "password123",
      });

      expect([400, 401, 403, 404]).toContain(res.status);
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("message");
    });
  });
});
