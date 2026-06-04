import "dotenv/config";
import express, { Request, Response } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { initializeApp } from "firebase/app";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from "firebase/auth";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  deleteDoc, 
  collection, 
  query, 
  where,
  setLogLevel
} from "firebase/firestore";
import firebaseConfig from "./firebase-applet-config.json";

// Set Silent logging level for Firestore client to silence idle stream cancel warnings
try {
  setLogLevel("silent");
} catch (e) {
  console.warn("Could not set Firestore log level:", e);
}

// Initialize Firebase Core Client on express node runtime
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
const firebaseAuth = getAuth(firebaseApp);

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

// Shared fallback generators when Gemini is unavailable or rate-limited
function getDynamicFallbackInsights(transactions: any[], expenses: any[], products: any[]) {
  const lowStock = (products || []).filter((p: any) => p.stock !== undefined && Number(p.stock) <= 3);
  const duesTotal = (transactions || []).reduce((acc: number, t: any) => acc + (Number(t.dueBalance) || 0), 0);

  const expenseCategories: { [key: string]: number } = {};
  (expenses || []).forEach((e: any) => {
    const cat = e.cat || e.category || "Others";
    const amt = Number(e.amount) || 0;
    expenseCategories[cat] = (expenseCategories[cat] || 0) + amt;
  });
  let maxExpenseCat = "Others";
  let maxExpenseAmt = 0;
  Object.entries(expenseCategories).forEach(([cat, amt]) => {
    if (amt > maxExpenseAmt) {
      maxExpenseAmt = amt;
      maxExpenseCat = cat;
    }
  });

  const list = [];

  // 1. Cashflow & Dues Insight
  if (duesTotal > 0) {
    list.push({
      title: "📊 বকেয়া পাওনা সতর্কতা (Outstanding Due Alert)",
      description: `আপনার স্টোরের বকেয়া খাতার মোট ব্যালেন্স **৳${duesTotal.toLocaleString()}**। ব্যবসার ক্যাশফ্লো সচল ও হেলদি রাখতে বাকী খাতা নিয়মিত পর্যালোচনা করুন এবং পাওনা সংগ্রহ ত্বরান্বিত করুন।`,
      type: "warning" as const
    });
  } else {
    list.push({
      title: "💰 শতভাগ ক্যাশ রিসিভড (100% Cashflow Secured)",
      description: "চমৎকার! আপনার স্টোরের বকেয়া খাতা সম্পূর্ণ পরিষ্কার, সমস্ত লেনদেন সফলভাবে আদায় করা হয়েছে। এটি ব্যবসার ওয়ার্কিং ক্যাপিটাল সচল রাখতে অগ্রণী ভূমিকা রাখবে।",
      type: "success" as const
    });
  }

  // 2. Stock Inventory Insight
  if (lowStock.length > 0) {
    const names = lowStock.slice(0, 3).map((p: any) => p.name).join(", ");
    list.push({
      title: "⚠️ স্টক রিঅর্ডার সতর্কতা (Inventory Stock Alert)",
      description: `স্টোরে **${names}** সহ কিছু পণ্যের স্টক ফুরিয়ে আসছে (স্টক লেভেল ৩ বা তার নিচে)। ক্রেতার চাহিদা মেটাতে অবিলম্বে নতুন স্টক অর্ডার দিন।`,
      type: "info" as const
    });
  } else {
    list.push({
      title: "📦 স্টক ইন্টিগ্রিটি সন্তোষজনক (Inventory Health Good)",
      description: "স্টোরের সব প্রোডাক্টের পরিমিত ভারসাম্যপূর্ণ স্টক লেভেল রয়েছে। অনাকাঙ্ক্ষিতভাবে ফাঁকা স্টকে পড়ার ঝুঁকি নেই।",
      type: "info" as const
    });
  }

  // 3. Expense Control Insight
  if (maxExpenseAmt > 0) {
    list.push({
      title: "💸 ব্যয় পর্যালোচনা ও অপ্টিমাইজেশন (Expense Focus)",
      description: `চলতি মেয়াদে আপনার সর্বোচ্চ খরচ হয়েছে **${maxExpenseCat}** ক্যাটাগরিতে (মোট **৳${maxExpenseAmt.toLocaleString()}**)। নিট প্রফিট বাড়াতে অপ্রয়োজনীয় পরিচালনা ব্যয় হ্রাস করুন।`,
      type: "success" as const
    });
  } else {
    list.push({
      title: "📈 পরিচালনা ব্যয় নিয়ন্ত্রণ (Low Operational Expense)",
      description: "এই সপ্তাহে কোনো অস্বাভাবিক অতিরিক্ত ব্যয় নথিভুক্ত হয়নি। খরচের সামঞ্জস্য বজায় রাখলে ব্যবসার ক্যাশ মার্জিন বৃদ্ধি পাবে।",
      type: "success" as const
    });
  }

  return list;
}

function classifyExpenseLocally(description: string): string {
  const desc = (description || "").toLowerCase();
  if (desc.includes("rent") || desc.includes("ভাড়া") || desc.includes("দোকান") || desc.includes("shop rent")) return "Rent";
  if (desc.includes("electric") || desc.includes("power") || desc.includes("বিল") || desc.includes("current") || desc.includes("বিদ্যুৎ") || desc.includes("utility")) return "Electricity";
  if (desc.includes("salary") || desc.includes("wage") || desc.includes("বেতন") || desc.includes("staff") || desc.includes("কর্মচারী")) return "Salary";
  if (desc.includes("ad") || desc.includes("market") || desc.includes("promo") || desc.includes("ফেসবুক") || desc.includes("বিজ্ঞাপন") || desc.includes("marketing")) return "Marketing";
  return "Others";
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.get("/api/health", (req: Request, res: Response) => {
    res.json({ 
      status: "ok", 
      firebaseConfigured: !!firebaseConfig.apiKey,
      isUsingFallback: false 
    });
  });

  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    try {
      const cleanEmail = email.trim().toLowerCase();
      const creds = await createUserWithEmailAndPassword(firebaseAuth, cleanEmail, password);
      res.json({ 
        user: {
          id: creds.user.uid,
          uid: creds.user.uid,
          email: creds.user.email
        }
      });
    } catch (err: any) {
      let displayError = err.message || String(err);
      if (err.code === "auth/weak-password" || err.message?.includes("at least") || err.message?.includes("weak")) {
        displayError = "পাসওয়ার্ডটি কমপক্ষে ৬ অক্ষরের হতে হবে!";
      } else if (err.code === "auth/email-already-in-use" || err.message?.includes("already registered")) {
        displayError = "এই ইমেইলটি ইতিপূর্বে রেজিস্টার করা হয়েছে!";
      }
      res.status(400).json({ error: displayError });
    }
  });

  app.post("/api/auth/signin", async (req: Request, res: Response) => {
    const { email, password } = req.body;
    try {
      const cleanEmail = email.trim().toLowerCase();
      const creds = await signInWithEmailAndPassword(firebaseAuth, cleanEmail, password);
      res.json({ 
        user: {
          id: creds.user.uid,
          uid: creds.user.uid,
          email: creds.user.email
        }
      });
    } catch (err: any) {
      let displayError = err.message || String(err);
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.message?.toLowerCase().includes("credentials")) {
        displayError = "ভুল পাসওয়ার্ড! অথবা একাউন্টটি এখনো তৈরি করা হয়নি। পাসওয়ার্ডটি পুনরায় চেক করুন!";
      }
      res.status(400).json({ error: displayError });
    }
  });

  app.get("/api/db/fetch", async (req: Request, res: Response) => {
    const { table, owner_email } = req.query;
    try {
      let q;
      if (table === "business_info") {
        q = collection(db, String(table));
      } else {
        q = query(collection(db, String(table)), where("user_id", "==", String(owner_email)));
      }
      const docsSnap = await getDocs(q);
      const records = docsSnap.docs.map(docSnapshot => docSnapshot.data());
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/db/upsert", async (req: Request, res: Response) => {
    const { table, id, data } = req.body;
    try {
      await setDoc(doc(db, String(table), String(id)), { id, ...data });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/db/delete", async (req: Request, res: Response) => {
    const { table, id } = req.body;
    try {
      await deleteDoc(doc(db, String(table), String(id)));
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/passcode_syncs/get", async (req: Request, res: Response) => {
    const { id, email } = req.query;
    try {
      if (email) {
        const passcodeRef = collection(db, "passcode_syncs");
        const q = query(passcodeRef, where("linked_email", "==", String(email).trim().toLowerCase()));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          const docs = querySnap.docs.map(docSnapshot => docSnapshot.data());
          docs.sort((a: any, b: any) => {
            const t1 = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const t2 = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            return t2 - t1;
          });
          return res.json(docs[0]);
        }
        return res.json(null);
      }

      if (!id) {
        return res.status(400).json({ error: "Missing id or email parameter" });
      }

      const docSnap = await getDoc(doc(db, "passcode_syncs", String(id)));
      if (docSnap.exists()) {
        return res.json(docSnap.data());
      }
      res.json(null);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/passcode_syncs/upsert", async (req: Request, res: Response) => {
    const { payload } = req.body;
    try {
      if (payload && payload.id) {
        const incomingProductsCount = (payload.products || []).length;
        const incomingTransactionsCount = (payload.transactions || []).length;
        
        if (incomingProductsCount === 0 && incomingTransactionsCount === 0) {
          const docSnap = await getDoc(doc(db, "passcode_syncs", payload.id));
          if (docSnap.exists()) {
            const existing = docSnap.data();
            const existingProductsCount = (existing.products || []).length;
            const existingTransactionsCount = (existing.transactions || []).length;
            if (existingProductsCount > 0 || existingTransactionsCount > 0) {
              console.log(`[Server Sync] Stopped blank payload override for sync ID: ${payload.id}`);
              return res.json({ success: true, ignored: true, message: "Protected existing non-empty cloud backup." });
            }
          }
        }
      }
      await setDoc(doc(db, "passcode_syncs", payload.id), payload);
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // API Endpoint: Intelligent Business Insights
  app.post("/api/ai/insights", async (req: Request, res: Response) => {
    const { transactions, expenses, products } = req.body;
    try {
      const dataSummary = {
        transactions: (transactions || []).slice(0, 30).map((t: any) => ({ type: t.type, total: t.total, date: t.date })),
        expenses: (expenses || []).map((e: any) => ({ cat: e.category, amount: e.amount, desc: e.description })),
        products: (products || []).map((p: any) => ({ name: p.name, stock: p.stock, buy: p.buyPrice, sell: p.sellPrice }))
      };

      let ai: GoogleGenAI;
      try {
        ai = getGeminiClient();
      } catch (err: any) {
        // Silent default dynamic fallback
        res.json(getDynamicFallbackInsights(transactions, expenses, products));
        return;
      }

      const prompt = `You are a professional retail and shop business analytical advisor. Analyze the store's current transactions, expenses, and products data in JSON format: ${JSON.stringify(dataSummary)}. Suggest 3 strategic business decisions or insights written strictly in a professional mixture of elegant Bengali and English (Banglish / pure Bengali with key business nouns in English) for local small/medium shop operations. For example, explain stock management, profit margins, expense categories, and customer credits.
Format the output ONLY as a valid JSON list of objects with the exact schema block:
[{"title":"Title Text (Mixed Bengali-English Title)","description":"Detailed actionable advice with bold marker '**' for emphasis","type":"warning"|"success"|"info"}]`;

      let jsonStr = "[]";
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            systemInstruction: "You are an elite, friendly business auditor specializing in retail stores and general shops."
          }
        });
        jsonStr = response.text?.trim() || "[]";
      } catch (geminiErr: any) {
        // Safely handle 429 quota exhaustion or model rate limits silently, serving live personalized recommendations.
        const msg = geminiErr.message || String(geminiErr);
        if (msg.includes("429") || msg.includes("quota") || msg.includes("RESOURCE_EXHAUSTED")) {
          console.log("[AI Insights] Serving live high-fidelity fallback insights (Gemini quota exhausted).");
        } else {
          console.warn("[AI Insights] Gemini unavailable, serving live dynamic fallback:", msg);
        }
        res.json(getDynamicFallbackInsights(transactions, expenses, products));
        return;
      }

      try {
        const result = JSON.parse(jsonStr);
        res.json(result);
      } catch (jsonErr: any) {
        res.json(getDynamicFallbackInsights(transactions, expenses, products));
      }
    } catch (error: any) {
      res.json(getDynamicFallbackInsights(transactions, expenses, products));
    }
  });

  // API Endpoint: Intelligent Expense Classification
  app.post("/api/ai/expense-category", async (req: Request, res: Response) => {
    const { description } = req.body;
    try {
      if (!description) {
        res.json({ category: "Others" });
        return;
      }

      let ai: GoogleGenAI;
      try {
        ai = getGeminiClient();
      } catch (err: any) {
        res.json({ category: classifyExpenseLocally(description) });
        return;
      }

      const categories = ["Rent", "Electricity", "Salary", "Marketing", "Others"];
      const prompt = `Classify this business expense based on its description: "${description}". Choose exactly one category from this restricted list: ${categories.join(", ")}. Return only the category name directly, with no surrounding quotes or markings.`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt
      });

      const category = response.text?.trim() || classifyExpenseLocally(description);
      res.json({ category });
    } catch (error: any) {
      res.json({ category: classifyExpenseLocally(description) });
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
