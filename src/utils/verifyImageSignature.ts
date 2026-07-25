import fs from "fs/promises";

const ALLOWED_SIGNATURES = ["jpg", "png", "webp"];

export async function verifyImageOrDelete(filePath: string): Promise<boolean> {
  const { fileTypeFromFile } = await import("file-type");
  const type = await fileTypeFromFile(filePath);
  if (!type || !ALLOWED_SIGNATURES.includes(type.ext)) {
    await fs.unlink(filePath).catch(() => {});
    return false;
  }
  return true;
}
