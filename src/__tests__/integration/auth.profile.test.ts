import request from "supertest";
import app from "../../app";
import { UserModel } from "../../models/user.model";
import mongoose from "mongoose";
import path from "path";
import fs from "fs";

path.join(__dirname, "..", "assets", "sample.txt");

describe("Auth Profile Integration Tests (whoamI + update-profile)", () => {
  const email = "profile@test.com";
  const password = "password123";

  let token = "";

  beforeAll(async () => {
    await UserModel.deleteMany({ email });

    // register
    await request(app).post("/api/auth/register").send({
      username: "profile-user",
      email,
      password,
      confirmPassword: password,
    });

    // login to get token
    const loginRes = await request(app).post("/api/auth/login").send({
      email,
      password,
    });

    expect(loginRes.status).toBe(200);
    token = loginRes.body.token;
    expect(token).toBeTruthy();
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await UserModel.deleteMany({ email });
    }
  });

  describe("GET /api/auth/whoamI", () => {
    test("should fail without token", async () => {
      const res = await request(app).get("/api/auth/whoamI");
      expect([401, 403]).toContain(res.status);
      expect(res.body).toHaveProperty("message");
    });

    test("should return current logged in user with token", async () => {
      const res = await request(app)
        .get("/api/auth/whoamI")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("data");

      // optional checks if your controller returns these fields
      expect(res.body.data).toHaveProperty("email", email);
      expect(res.body.data).toHaveProperty("username");
    });
  });

  describe("PUT /api/auth/update-profile", () => {
    test("should fail without token", async () => {
      const res = await request(app).put("/api/auth/update-profile").send({
        username: "new-name",
      });

      expect([401, 403]).toContain(res.status);
      expect(res.body).toHaveProperty("message");
    });

    test("should update profile fields with token (no image)", async () => {
      const res = await request(app)
        .put("/api/auth/update-profile")
        .set("Authorization", `Bearer ${token}`)
        .send({
          username: "profile-user-updated",
          phoneNumber: "9800000000",
          location: "Kathmandu",
        });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("message", "User updated successfully");
      expect(res.body).toHaveProperty("data");

      expect(res.body.data).toHaveProperty("username", "profile-user-updated");
      expect(res.body.data).toHaveProperty("phoneNumber", "9800000000");
      expect(res.body.data).toHaveProperty("location", "Kathmandu");
    });

    test("should update profile with image upload (multipart)", async () => {
      const assetsDir = path.join(__dirname, "..", "assets");
      const imagePath = path.join(assetsDir, "test-image.png");

      // ensure folder exists
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      // write a real 1x1 PNG (base64)
      const pngBase64 =
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X9lS8AAAAASUVORK5CYII=";
      fs.writeFileSync(imagePath, Buffer.from(pngBase64, "base64"));

      expect(fs.existsSync(imagePath)).toBe(true);

      const res = await request(app)
        .put("/api/auth/update-profile")
        .set("Authorization", `Bearer ${token}`)
        .field("username", "profile-user-with-image")
        .attach("image", imagePath); // multer expects "image"

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("data");
      expect(res.body.data).toHaveProperty("image"); // should be /uploads/...
    });
  });
  describe("DELETE /api/auth/me", () => {
    test("should fail without token", async () => {
      const res = await request(app).delete("/api/auth/me").send({
        password,
      });

      expect([401, 403]).toContain(res.status);
      expect(res.body).toHaveProperty("message");
    });

    test("should fail if password is wrong", async () => {
      const res = await request(app)
        .delete("/api/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ password: "wrongpassword" });

      expect([400, 401, 403]).toContain(res.status);
      expect(res.body).toHaveProperty("message");
    });

    test("should delete account with correct password", async () => {
      const res = await request(app)
        .delete("/api/auth/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ password });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty(
        "message",
        "Account deleted successfully",
      );

      // confirm user is gone
      const user = await UserModel.findOne({ email }).lean();
      expect(user).toBeNull();
    });

    test("should not login after account is deleted", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email,
        password,
      });

      // your login returns 404 if user not found
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("message");
    });
  });
});
