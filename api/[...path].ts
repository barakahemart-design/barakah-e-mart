import type { Request, Response } from "express";
import { getServerlessApp } from "../server";

export default async function handler(req: Request, res: Response) {
  const app = await getServerlessApp();
  app(req, res);
}
