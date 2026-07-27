import fs from "fs/promises";
import * as FileType from "file-type";

const ALLOWED_SIGNATURES = ["jpg", "png", "webp"];

export async function verifyImageOrDelete(filePath: string): Promise<boolean> {
  const type = await FileType.fromFile(filePath);

  if (!type || !ALLOWED_SIGNATURES.includes(type.ext)) {
    await fs.unlink(filePath).catch(() => {});
    return false;
  }

  return true;
}
