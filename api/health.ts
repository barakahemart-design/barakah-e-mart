import type { Request, Response } from "express";

export default async function handler(req: Request, res: Response) {
  try {
    // Load the application lazily so startup/import failures can be reported as JSON
    // instead of Vercel's opaque FUNCTION_INVOCATION_FAILED response.
    const { getServerlessApp } = await import("../server");
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
