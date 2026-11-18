import type { Request, Response } from "express";
import { getServerlessApp } from "../server.ts";

export default async function handler(req: Request, res: Response) {
  try {
    // Keep this as a static import so Vercel bundles server.ts and its dependencies
    // into the function instead of trying to resolve /var/task/server at runtime.
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
