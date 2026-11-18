import type { Request, Response } from "express";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export default async function handler(req: Request, res: Response) {
  const routePath = Array.isArray(req.query.path)
    ? req.query.path.join("/")
    : String(req.query.path ?? "");
  const forwardedQuery = new URLSearchParams();

  for (const [key, value] of Object.entries(req.query)) {
    if (key === "path" || value == null) continue;
    if (Array.isArray(value)) {
      value.forEach((item) => forwardedQuery.append(key, String(item)));
    } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      forwardedQuery.append(key, String(value));
    }
  }

  req.url = `/api/${routePath}${forwardedQuery.size ? `?${forwardedQuery.toString()}` : ""}`;

  const { getServerlessApp } = require("../dist/server.cjs") as {
    getServerlessApp: () => Promise<import("express").Express>;
  };
  const app = await getServerlessApp();
  app(req, res);
}