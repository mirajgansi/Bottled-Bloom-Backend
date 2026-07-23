// src/middleware/upload.middleware.ts
import multer from "multer";
import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { Request } from "express";
import { HttpError } from "../errors/http-error";

const uploadDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// ✅ single source of truth: mimetype -> safe extension
// never derive the extension from file.originalname (client-controlled)
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req: Request, file, cb) {
    const ext = MIME_TO_EXT[file.mimetype];
    if (!ext) {
      // fileFilter should already have blocked this, but never trust
      // a single layer — refuse to write a file with an unknown type
      return cb(new HttpError(400, "Unsupported file type"), "");
    }
    cb(null, `${randomUUID()}${ext}`);
  },
});

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback,
) => {
  if (!MIME_TO_EXT[file.mimetype]) {
    return cb(new HttpError(400, "Only JPG, PNG, or WEBP images are allowed"));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 5 },
});

export const uploads = {
  single: (fieldName: string) => upload.single(fieldName),
  array: (fieldName: string, maxCount: number) =>
    upload.array(fieldName, maxCount),
  fields: (fieldsArray: { name: string; maxCount?: number }[]) =>
    upload.fields(fieldsArray),
};
