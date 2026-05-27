import "dotenv/config";
import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is not configured in your environment variables. Please open settings and save GEMINI_API_KEY.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Fallback credentials for Supabase demo
  const fallbackUrl = "https://cmanayslirpenaruncwr.supabase.co";
  const fallbackKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNtYW5heXNsaXJwZW5hcnVuY3dyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3MTQwNDQsImV4cCI6MjA5NTI5MDA0NH0.f4-DddnnqnknJ_X-4rVjes7a32QlI59cdEW1eyQkads";

  let rawUrl = process.env.VITE_SUPABASE_URL || fallbackUrl;
  let rawKey = process.env.VITE_SUPABASE_ANON_KEY || fallbackKey;

  if (rawUrl.includes("bsaumznrvfcqwhqdpdgo")) {
    rawUrl = fallbackUrl;
    rawKey = fallbackKey;
  }

  const supabaseUrl = rawUrl.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  const supabaseAnonKey = rawKey.trim();
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  app.get("/api/health", (req: Request, res: Response) => {
    res.json({ 
      status: "ok", 
      supabaseConfigured: !!supabaseUrl,
      isUsingFallback: supabaseUrl === fallbackUrl
    });
  });

  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    try {
      const origin = req.get('origin') || `${req.protocol}://${req.get('host')}`;
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: password,
        options: { emailRedirectTo: origin }
      });
      if (error) {
        let displayError = error.message;
        if (error.message.includes("at least 6") || error.message.includes("weak") || error.message.includes("should be at least")) {
          displayError = "পাসওয়ার্ডটি কমপক্ষে ৬ অক্ষরের হতে হবে!";
        }
        return res.status(400).json({ error: displayError });
      }
      res.json({ user: data.user, session: data.session });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/auth/signin", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const cleanEmail = email.trim().toLowerCase();
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: password,
      });
      
      if (error) {
        // Return clear, user-friendly translation or guidelines alongside error
        let displayError = error.message;
        if (error.message === "Email not confirmed") {
          displayError = "আপনার ইমেইল কনফার্মেশন পেন্ডিং আছে। অনুগ্রহ করে ইনবক্স চেক করুন অথবা 'Passcode Cloud Sync' ব্যবহার করে ৪-সংখ্যার কোড দিয়ে সরাসরি লগইন করুন!";
        } else if (error.message === "Invalid login credentials") {
          displayError = "ভুল পাসওয়ার্ড! অথবা একাউন্টটি এখনো তৈরি করা হয়নি। পাসওয়ার্ডটি পুনরায় চেক করুন অথবা 'Create a New Store Account' এ ক্লিক করুন!";
        }
        
        return res.status(400).json({ error: displayError });
      }
      
      res.json({ user: data.user, session: data.session });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/db/fetch", async (req: Request, res: Response) => {
    const { table, owner_email } = req.query;
    try {
      const { data, error } = await supabase
        .from(String(table))
        .select("*")
        .eq("owner_email", String(owner_email));
      if (error) return res.status(400).json({ error: error.message });
      res.json(data || []);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/db/upsert", async (req: Request, res: Response) => {
    const { table, id, data } = req.body;
    try {
      const { error } = await supabase
        .from(String(table))
        .upsert({ id, ...data }, { onConflict: "id" });
      if (error) return res.status(400).json({ error: error.message });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/db/delete", async (req: Request, res: Response) => {
    const { table, id } = req.body;
    try {
      const { error } = await supabase.from(String(table)).delete().eq("id", id);
      if (error) return res.status(400).json({ error: error.message });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/passcode_syncs/get", async (req: Request, res: Response) => {
    const { id, email } = req.query;
    try {
      if (email) {
        const { data, error } = await supabase
          .from("passcode_syncs")
          .select("*")
          .eq("linked_email", String(email).trim().toLowerCase());
          
        if (error) return res.status(400).json({ error: error.message });
        
        if (data && data.length > 0) {
          // Sort descending by updated_at to ensure the latest backup gets restored
          data.sort((a: any, b: any) => {
            const t1 = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const t2 = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            return t2 - t1;
          });
          return res.json(data[0]);
        }
        return res.json(null);
      }

      if (!id) {
        return res.status(400).json({ error: "Missing id or email parameter" });
      }

      const { data, error } = await supabase
        .from("passcode_syncs")
        .select("*")
        .eq("id", String(id))
        .maybeSingle();
      if (error) return res.status(400).json({ error: error.message });
      res.json(data || null);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/passcode_syncs/upsert", async (req: Request, res: Response) => {
    const { payload } = req.body;
    try {
      if (payload && payload.id) {
        // Prevent blank/initial states from overwriting populated states in the cloud database
        const incomingProductsCount = (payload.products || []).length;
        const incomingTransactionsCount = (payload.transactions || []).length;
        
        if (incomingProductsCount === 0 && incomingTransactionsCount === 0) {
          // Fetch existing backup from the database
          const { data: existing } = await supabase
            .from("passcode_syncs")
            .select("products, transactions")
            .eq("id", payload.id)
            .maybeSingle();
            
          if (existing) {
            const existingProductsCount = (existing.products || []).length;
            const existingTransactionsCount = (existing.transactions || []).length;
            if (existingProductsCount > 0 || existingTransactionsCount > 0) {
              console.log(`[Sync Guard] Stopped blank payload override for sync ID: ${payload.id}`);
              return res.json({ success: true, ignored: true, message: "Protected existing non-empty cloud backup." });
            }
          }
        }
      }
      const { error } = await supabase.from("passcode_syncs").upsert(payload);
      if (error) return res.status(400).json({ error: error.message });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Endpoint: Intelligent Business Insights
  app.post("/api/ai/insights", async (req: Request, res: Response) => {
    try {
      const { transactions, expenses, products } = req.body;
      const dataSummary = {
        transactions: (transactions || []).slice(0, 30).map((t: any) => ({ type: t.type, total: t.total, date: t.date })),
        expenses: (expenses || []).map((e: any) => ({ cat: e.category, amount: e.amount, desc: e.description })),
        products: (products || []).map((p: any) => ({ name: p.name, stock: p.stock, buy: p.buyPrice, sell: p.sellPrice }))
      };

      let ai: GoogleGenAI;
      try {
        ai = getGeminiClient();
      } catch (err: any) {
        // Fallback insights if API key is not configured or fails
        res.json([
          {
            title: " ক্যাশফ্লো সর্তকতা (Cashflow Balance Alert)",
            description: "আপনার স্টোরে নগদ বিক্রয়ের তুলনায় বাকী বিক্রির হার সামঞ্জস্যপূর্ণ রাখা উচিত। বাকী খাতা নিয়মিত পর্যালোচনা করুন এবং পাওনা সংগ্রহ বেগবান করুন।",
            type: "warning"
          },
          {
            title: " স্টক অ্যালার্ট (Stock & Inventory Alert)",
            description: "কয়েকটি পণ্যের স্টক শেষ হয়ে যাচ্ছে। গ্রাহকের চাহিদা মেটাতে অবিলম্বে নতুন স্টক অর্ডার করার পরামর্শ দেওয়া হলো।",
            type: "info"
          },
          {
            title: " ব্যয় অপ্টিমাইজেশন (Expense Control)",
            description: "গত সপ্তাহের তুলনায় এই সপ্তাহে আনুষঙ্গিক ব্যয় ৫% বৃদ্ধি পেয়েছে। বিদ্যুৎ বিল এবং অন্যান্য খরচ নিয়ন্ত্রণের চেষ্টা করুন।",
            type: "success"
          }
        ]);
        return;
      }

      const prompt = `You are a professional retail and shop business analytical advisor. Analyze the store's current transactions, expenses, and products data in JSON format: ${JSON.stringify(dataSummary)}. Suggest 3 strategic business decisions or insights written strictly in a professional mixture of elegant Bengali and English (Banglish / pure Bengali with key business nouns in English) for local small/medium shop operations. For example, explain stock management, profit margins, expense categories, and customer credits.
Format the output ONLY as a valid JSON list of objects with the exact schema block:
[{"title":"Title Text (Mixed Bengali-English Title)","description":"Detailed actionable advice with bold marker '**' for emphasis","type":"warning"|"success"|"info"}]`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          systemInstruction: "You are an elite, friendly business auditor specializing in retail stores and general shops."
        }
      });

      const jsonStr = response.text?.trim() || "[]";
      const result = JSON.parse(jsonStr);
      res.json(result);
    } catch (error: any) {
      console.error("Error generating business insights:", error);
      res.status(500).json({ error: error.message || "An error occurred during AI analysis." });
    }
  });

  // API Endpoint: Intelligent Expense Classification
  app.post("/api/ai/expense-category", async (req: Request, res: Response) => {
    try {
      const { description } = req.body;
      if (!description) {
        res.json({ category: "Others" });
        return;
      }

      let ai: GoogleGenAI;
      try {
        ai = getGeminiClient();
      } catch (err: any) {
        res.json({ category: "Others" });
        return;
      }

      const categories = ["Rent", "Electricity", "Salary", "Marketing", "Others"];
      const prompt = `Classify this business expense based on its description: "${description}". Choose exactly one category from this restricted list: ${categories.join(", ")}. Return only the category name directly, with no surrounding quotes or markings.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt
      });

      const category = response.text?.trim() || "Others";
      res.json({ category });
    } catch (error: any) {
      console.error("Error classifying expense:", error);
      res.json({ category: "Others" });
    }
  });

  // Serve static assets or use Vite dev server
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Proxy Server] running on http://localhost:${PORT}`);
  });
}

startServer();
