import { Request } from "express";
import { HttpError } from "../errors/http-error";

/**
 * Safely extracts a route param as a string.
 * Express types allow params to be string | string[] in edge cases
 * (e.g. repeated matrix params). Rejecting non-string values here
 * closes that gap instead of silently coercing/casting past it.
 */
export function getParam(req: Request, key: string): string {
  const value = req.params[key];
  if (typeof value !== "string" || value.length === 0) {
    throw new HttpError(400, `Invalid or missing parameter: ${key}`);
  }
  return value;
}
