import request from "supertest";
import app from "../../app";
import { UserModel } from "../../models/user.model";
import mongoose from "mongoose";

let lastResetCode: string | null = null;

// ✅ mock email sender and capture the 6-digit code from HTML
jest.mock("../../config/email", () => ({
  sendEmail: jest.fn(async (_to: string, _subject: string, html: string) => {
    const match = html.match(/<h2[^>]*>(\d{6})<\/h2>/);
    lastResetCode = match ? match[1] : null;
    return true;
  }),
}));

describe("Auth Reset Password Flow", () => {
  const email = "forgot@test.com";
  const oldPassword = "password123";
  const newPassword = "NewPassword123!";

  beforeAll(async () => {
    await UserModel.deleteMany({ email });

    await request(app).post("/api/auth/register").send({
      username: "forgot-user",
      email,
      password: oldPassword,
      confirmPassword: oldPassword,
    });
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await UserModel.deleteMany({ email });
    }
  });

  test("1) request-password-reset should succeed and send a code", async () => {
    lastResetCode = null;

    const res = await request(app)
      .post("/api/auth/request-password-reset")
      .send({ email });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");

    // ✅ ensure we captured the actual code sent via email
    expect(lastResetCode).toMatch(/^\d{6}$/);
  });

  test("2) verify-reset-code should succeed with correct code", async () => {
    expect(lastResetCode).toMatch(/^\d{6}$/);

    const res = await request(app).post("/api/auth/verify-reset-code").send({
      email,
      code: lastResetCode,
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  test("3) verify-reset-code should fail with wrong code", async () => {
    const res = await request(app).post("/api/auth/verify-reset-code").send({
      email,
      code: "000000",
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message");
  });

  test("4) reset-password should succeed with correct code", async () => {
    expect(lastResetCode).toMatch(/^\d{6}$/);

    const res = await request(app).post("/api/auth/reset-password").send({
      email,
      code: lastResetCode,
      newPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });

  test("5) login with NEW password should work", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email,
      password: newPassword,
    });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message", "Login successful");
  });

  test("6) login with OLD password should fail", async () => {
    const res = await request(app).post("/api/auth/login").send({
      email,
      password: oldPassword,
    });

    expect([400, 401, 403]).toContain(res.status);
    expect(res.body).toHaveProperty("message");
  });

  test("7) reset-password should fail if newPassword invalid", async () => {
    lastResetCode = null;
    await request(app).post("/api/auth/request-password-reset").send({ email });
    expect(lastResetCode).toMatch(/^\d{6}$/);

    const res = await request(app).post("/api/auth/reset-password").send({
      email,
      code: lastResetCode,
      newPassword: "123",
    });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("message");
  });
});
