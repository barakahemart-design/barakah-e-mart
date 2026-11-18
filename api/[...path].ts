import type { Request, Response } from "express";
import { getServerlessApp } from "../server.ts";

export default async function handler(req: Request, res: Response) {
  const app = await getServerlessApp();
  app(req, res);
}
