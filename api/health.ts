import type { Request, Response } from "express";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export default async function handler(req: Request, res: Response) {
  try {
    // The server bundle is built into dist/ and explicitly included in this function
    // by vercel.json. This avoids runtime imports of source-only TypeScript files.
    const { getServerlessApp } = require("../dist/server.cjs") as {
      getServerlessApp: () => Promise<import("express").Express>;
    };
    const app = await getServerlessApp();
    app(req, res);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown startup error";
    console.error("[api/health] Serverless app initialization failed:", message);
    if (!res.headersSent) {
      res.status(500).json({
        status: "error",
        stage: "serverless_app_initialization",
        error: message.slice(0, 500)
      });
    }
  }
}