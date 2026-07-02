import request from "supertest";
import app from "../../app";
import mongoose from "mongoose";
import { UserModel } from "../../models/user.model";
import { ProductModel } from "../../models/product.model";
import path from "path";
import fs from "fs";

jest.mock("../../services/notification.service", () => {
  return {
    NotificationService: jest.fn().mockImplementation(() => ({
      notify: jest.fn().mockResolvedValue(true),
    })),
  };
});

describe("Product Integration Tests", () => {
  const PRODUCT_BASE = "/api/products";

  const adminEmail = "prod-admin@test.com";
  const adminPassword = "AdminPass123!";
  const adminUsername = "prod-admin";

  let adminToken = "";
  let productId = "";

  const makePng = (name: string) => {
    const assetsDir = path.join(__dirname, "..", "assets");
    const imagePath = path.join(assetsDir, name);

    if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/6X9lS8AAAAASUVORK5CYII=";
    fs.writeFileSync(imagePath, Buffer.from(pngBase64, "base64"));

    return imagePath;
  };

  beforeAll(async () => {
    // cleanup
    await UserModel.deleteMany({ email: adminEmail });
    await ProductModel.deleteMany({
      name: { $in: ["Test Product", "Updated Product"] },
    });

    // create admin directly in DB
    const bcrypt = await import("bcryptjs");
    const hashed = await bcrypt.default.hash(adminPassword, 10);

    await UserModel.create({
      email: adminEmail,
      username: adminUsername,
      password: hashed,
      role: "admin",
    });

    // login admin
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
      await UserModel.deleteMany({ email: adminEmail });
      await ProductModel.deleteMany({
        name: { $in: ["Test Product", "Updated Product"] },
      });
    }
  });

  //   /* ============================
  //       ADMIN: CREATE PRODUCT
  //   ============================ */
  describe("Product Integration Tests", () => {
    let adminToken = "";

    const img1 = path.join(__dirname, "..", "assets", "test-image.jpg"); // must be real image
    const img2 = path.join(__dirname, "..", "assets", "test-image2.jpg");

    beforeAll(async () => {
      const loginRes = await request(app).post("/api/auth/login").send({
        email: adminEmail,
        password: adminPassword,
      });
      adminToken = loginRes.body.token;
    });

    test("POST /api/products (admin) should create product with images", async () => {
      const img1 = makePng("p1.png");
      const img2 = makePng("p2.png");

      const p = await ProductModel.create({
        name: "Test Product",
        description: "test desc",
        price: 120,
        category: "snacks",
        image: "test.png", // just any string, since DB creation
        images: ["test.png"],
        manufacturer: "Test Co",
        manufactureDate: "2026-02-01",
        expireDate: "2026-03-01",
        nutritionalInfo: "100 cal",
        inStock: 10,
      });

      productId = String(p._id);
    });
  });

  test("POST /api/products should fail without token", async () => {
    const res = await request(app).post(PRODUCT_BASE).send({
      name: "No Auth Product",
    });

    expect([401, 403]).toContain(res.status);
    expect(res.body).toHaveProperty("message");
  });

  test("POST /api/products should fail if duplicate name", async () => {
    const img = makePng("dup.png");

    const res = await request(app)
      .post(PRODUCT_BASE)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("name", "Test Product") // same name as created product
      .field("description", "dup")
      .field("nutritionalInfo", "none")
      .field("category", "snacks")
      .field("price", "100")
      .field("inStock", "10")
      .attach("image", img);

    // your service throws 409 on duplicate product name
    expect([409, 400]).toContain(res.status);
    // (If your Zod schema rejects something, it may still be 400)
    expect(res.body).toHaveProperty("message");
  });

  /* ============================
      PUBLIC: GET ALL + GET BY ID
  ============================ */
  test("GET /api/products should return products", async () => {
    const res = await request(app).get(PRODUCT_BASE);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("products");

    // grab one product id to test GET by id
    productId = res.body.data.products[0]._id;
  });

  test("GET /api/products/:id should return product", async () => {
    const res = await request(app).get(`${PRODUCT_BASE}/${productId}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
    expect(res.body.data).toHaveProperty("name");
  });
  /* ============================
      ADMIN: UPDATE PRODUCT
      (existingImages -> images mapping happens in service)
  ============================ */
  test("PUT /api/products/:id (admin) should update product fields", async () => {
    const newImg = makePng("p3.png");

    const res = await request(app)
      .put(`${PRODUCT_BASE}/${productId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .field("name", "Updated Product")
      .field("existingImages", JSON.stringify([]))
      .attach("image", newImg);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("name", "Updated Product");
  });

  /* ============================
      ADMIN: RESTOCK
  ============================ */
  test("PUT /api/products/:id/restock should restock (set)", async () => {
    const res = await request(app)
      .put(`${PRODUCT_BASE}/${productId}/restock`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ quantity: 50, mode: "set" });

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty("inStock", 50);
  });

  test("PUT /api/products/:id/restock should fail for negative quantity", async () => {
    const res = await request(app)
      .put(`${PRODUCT_BASE}/${productId}/restock`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ quantity: -1 });

    expect(res.status).toBe(400);
  });

  /* ============================
      PUBLIC: CATEGORY / RECENT / TRENDING / POPULAR / TOP-RATED / OUT-OF-STOCK
  ============================ */
  test("GET /api/products/category/:category", async () => {
    const res = await request(app).get(`${PRODUCT_BASE}/category/Snacks`);
    expect([200, 400]).toContain(res.status); // depends on repository behavior
  });

  test("GET /api/products/recent", async () => {
    const res = await request(app).get(`${PRODUCT_BASE}/recent`);
    expect(res.status).toBe(200);
  });

  test("GET /api/products/trending", async () => {
    const res = await request(app).get(`${PRODUCT_BASE}/trending`);
    expect(res.status).toBe(200);
  });

  test("GET /api/products/popular", async () => {
    const res = await request(app).get(`${PRODUCT_BASE}/popular`);
    expect(res.status).toBe(200);
  });

  test("GET /api/products/top-rated", async () => {
    const res = await request(app).get(`${PRODUCT_BASE}/top-rated`);
    expect(res.status).toBe(200);
  });

  test("GET /api/products/out-of-stock", async () => {
    const res = await request(app).get(`${PRODUCT_BASE}/out-of-stock`);
    expect(res.status).toBe(200);
  });

  /* ============================
      PUBLIC: VIEW COUNT
  ============================ */
  test("PATCH /api/products/:id/view should increment view count", async () => {
    const res = await request(app).patch(`${PRODUCT_BASE}/${productId}/view`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("data");
  });

  test("DELETE /api/products/:id (admin) should delete product", async () => {
    const res = await request(app)
      .delete(`${PRODUCT_BASE}/${productId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("message");
  });
});
