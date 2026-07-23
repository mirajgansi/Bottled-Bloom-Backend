// src/utils/deleteUploadedFile.ts
import fs from "fs/promises";
import path from "path";

const UPLOAD_DIR = path.join(__dirname, "../../uploads");

/**
 * Deletes a file referenced by its public URL path (e.g. "/uploads/abc.png").
 * Never throws — a missing file or bad path just gets skipped.
 * Path-traversal safe: resolves against UPLOAD_DIR and verifies containment.
 */
export async function deleteUploadedFile(urlPath?: string): Promise<void> {
  if (!urlPath || !urlPath.startsWith("/uploads/")) return;

  const filename = path.basename(urlPath); // strips any ../ traversal attempt
  const fullPath = path.join(UPLOAD_DIR, filename);

  // ensure resolved path is still inside UPLOAD_DIR
  if (!fullPath.startsWith(UPLOAD_DIR)) return;

  await fs.unlink(fullPath).catch(() => {
    // file already gone / never existed — not an error condition
  });
}

export async function deleteUploadedFiles(
  urlPaths: (string | undefined)[],
): Promise<void> {
  await Promise.all(urlPaths.map((p) => deleteUploadedFile(p)));
}
