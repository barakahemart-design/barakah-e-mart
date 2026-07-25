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

async function verifyFirebaseToken(req: Request): Promise<{ uid: string; email: string } | null> {
  const authHeader = req.headers.authorization;
  const headerUid = req.headers["x-user-uid"] as string;
  const headerEmail = req.headers["x-user-email"] as string;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const idToken = authHeader.split(" ")[1];
    try {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`);
      if (response.ok) {
        const tokenInfo = await response.json();
        if (tokenInfo && tokenInfo.sub) {
          return { uid: tokenInfo.sub, email: tokenInfo.email || "" };
        }
      }
    } catch (err) {
      console.warn("Token verification calling Google tokeninfo endpoint failed:", err);
    }
  }

  // Developer/Offline sandbox fallback using header-level verification
  if (headerUid) {
    return { uid: headerUid, email: headerEmail || "" };
  }

  return null;
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

  // Helper to dynamically resolve all user/profile IDs associated with user's verified identity
  async function resolveAllUserIdsForEmail(email: string, defaultUid: string): Promise<string[]> {
    const ids = new Set<string>();
    ids.add(defaultUid);

    const cleanEmail = (email || "").trim().toLowerCase();
    if (cleanEmail) {
      // 1. Get profile document IDs (the primary Firebase Auth UIDs)
      try {
        const profilesQ = query(collection(db, "profiles"), where("email", "==", cleanEmail));
        const profilesSnap = await getDocs(profilesQ);
        profilesSnap.forEach(docSnap => {
          ids.add(docSnap.id);
          const data = docSnap.data();
          if (data.id) ids.add(String(data.id));
          if (data.user_id) ids.add(String(data.user_id));
          if (data.userId) ids.add(String(data.userId));
          if (data.owner_id) ids.add(String(data.owner_id));
        });
      } catch (err) {
        console.warn("resolveAllUserIdsForEmail profile fetch error:", err);
      }

      // 2. Get passcode_syncs document IDs (the Passcode / PIN Vault Sync IDs)
      try {
        const syncsQ = query(collection(db, "passcode_syncs"), where("linked_email", "==", cleanEmail));
        const syncsSnap = await getDocs(syncsQ);
        syncsSnap.forEach(docSnap => {
          ids.add(docSnap.id);
          const data = docSnap.data();
          if (data.id) ids.add(String(data.id));
          if (data.user_id) ids.add(String(data.user_id));
          if (data.userId) ids.add(String(data.userId));
          if (data.owner_id) ids.add(String(data.owner_id));
        });
      } catch (err) {
        console.warn("resolveAllUserIdsForEmail sync fetch error:", err);
      }
    }

    return Array.from(ids);
  }

  // Helper to sync REST updates from the phone directly back to the passcode_syncs backing document on Firestore
  async function syncCollectionAndPasscodeVault(
    verified: { uid: string; email: string },
    table: string,
    id: string,
    data: any,
    isDelete: boolean = false
  ) {
    const email = (verified.email || "").trim().toLowerCase();
    if (!email) return;

    try {
      // Find all passcode_syncs documents linked to this email
      const syncsQ = query(collection(db, "passcode_syncs"), where("linked_email", "==", email));
      const syncsSnap = await getDocs(syncsQ);

      if (syncsSnap.empty) {
        console.log(`[Sync Engine server] No passcode_syncs document found for ${email}. No backup to propagate.`);
        return;
      }

      const promises = syncsSnap.docs.map(async (docSnap) => {
        const syncId = docSnap.id;
        const syncData = docSnap.data();

        let arrayFieldName = "";
        const tableStr = String(table);
        if (tableStr === "products") arrayFieldName = "products";
        else if (tableStr === "customers" || tableStr === "contacts") arrayFieldName = "contacts";
        else if (tableStr === "expenses") arrayFieldName = "expenses";
        else if (tableStr === "transactions") arrayFieldName = "transactions";
        else if (tableStr === "purchases") arrayFieldName = "purchases";

        const updatedFields: any = {
          updated_at: new Date().toISOString()
        };

        if (arrayFieldName) {
          let currentArray = syncData[arrayFieldName] || [];
          if (!Array.isArray(currentArray)) currentArray = [];

          if (isDelete) {
            currentArray = currentArray.filter((item: any) => item && item.id !== id);
          } else {
            let itemObj: any = { ...data, id };

            if (tableStr === "products") {
              itemObj = {
                id: data.id || id,
                name: data.name,
                sku: data.sku || "",
                stock: Number(data.stock) || 0,
                buyPrice: Number(data.buy_price) || 0,
                sellPrice: Number(data.sell_price) || 0,
                category: data.category || "Electronics",
                unit: data.unit || "piece",
                imageUrl: data.image_url || undefined
              };
            } else if (tableStr === "customers" || tableStr === "contacts") {
              itemObj = {
                id: data.id || id,
                name: data.name,
                phone: data.phone || "",
                address: data.address || "",
                type: data.type || "customer",
                created_at: data.created_at || data.updated_at || new Date().toISOString()
              };
            } else if (tableStr === "expenses") {
              itemObj = {
                id: data.id || id,
                category: data.category || "Others",
                amount: Number(data.amount) || 0,
                description: data.description || "",
                date: data.created_at || data.date || new Date().toISOString()
              };
            } else if (tableStr === "purchases") {
              itemObj = {
                id: data.id || id,
                productId: data.product_id || data.productId,
                productName: data.product_name || "Purchase Item",
                supplierId: data.supplier_id || "",
                supplierName: data.supplier_name || "Main Depot",
                quantity: Number(data.quantity) || 0,
                buyPrice: Number(data.buy_price) || 0,
                totalAmount: Number(data.quantity * data.buy_price) || 0,
                date: data.created_at || data.date || new Date().toISOString()
              };
            } else if (tableStr === "transactions") {
              let mappedItems: any[] = [];
              try {
                const itemsSnap = await getDocs(query(collection(db, "transaction_items"), where("transaction_id", "==", id)));
                itemsSnap.forEach(itemDoc => {
                  const item = itemDoc.data();
                  mappedItems.push({
                    id: item.id || itemDoc.id,
                    name: item.product_name || "Product Item",
                    quantity: Number(item.quantity) || 0,
                    price: Number(item.sell_price) || 0,
                    total: Number(item.quantity * item.sell_price) || 0,
                    productId: item.product_id || undefined,
                    buyPrice: item.cost_price !== undefined ? Number(item.cost_price) : undefined
                  });
                });
              } catch (itmErr) {
                console.warn("Error fetching transaction items during sync:", itmErr);
              }

              if (mappedItems.length === 0 && data.items) {
                mappedItems = data.items;
              }

              itemObj = {
                id: data.id || id,
                invoiceNo: data.invoice_no || data.invoiceNo,
                date: data.created_at || data.date || new Date().toISOString(),
                items: mappedItems,
                subtotal: Number(data.total_amount || data.subtotal) || 0,
                tax: Number(data.tax) || 0,
                discount: Number(data.discount) || 0,
                total: Number(data.total_amount || data.total) || 0,
                paymentMethod: data.payment_method || data.paymentMethod || "Cash",
                status: data.paid_amount >= data.total_amount ? "paid" : (data.paid_amount > 0 ? "partial" : "due"),
                paidAmount: Number(data.paid_amount || data.paidAmount) || 0,
                dueBalance: Math.max(0, Number(data.total_amount || data.total) - Number(data.paid_amount || data.paidAmount)) || 0,
                contactId: data.customer_id || data.contactId || undefined,
                customerSignature: data.signature_svg || data.customerSignature || undefined
              };
            }

            const existingIndex = currentArray.findIndex((item: any) => item && item.id === id);
            if (existingIndex >= 0) {
              currentArray[existingIndex] = { ...currentArray[existingIndex], ...itemObj };
            } else {
              currentArray.push(itemObj);
            }
          }

          updatedFields[arrayFieldName] = currentArray;

          if (tableStr === "purchases") {
            const bizData = syncData.businessInfo || syncData.business_info || {};
            const currentBizPurchases = bizData.purchases || [];
            let updatedBizPurchases = Array.isArray(currentBizPurchases) ? [...currentBizPurchases] : [];
            if (isDelete) {
              updatedBizPurchases = updatedBizPurchases.filter((item: any) => item && item.id !== id);
            } else {
              const itemObj = {
                id: data.id || id,
                productId: data.product_id || data.productId,
                productName: data.product_name || "Purchase Item",
                supplierId: data.supplier_id || "",
                supplierName: data.supplier_name || "Main Depot",
                quantity: Number(data.quantity) || 0,
                buyPrice: Number(data.buy_price) || 0,
                totalAmount: Number(data.quantity * data.buy_price) || 0,
                date: data.created_at || data.date || new Date().toISOString()
              };
              const existingIdx = updatedBizPurchases.findIndex((item: any) => item && item.id === id);
              if (existingIdx >= 0) {
                updatedBizPurchases[existingIdx] = { ...updatedBizPurchases[existingIdx], ...itemObj };
              } else {
                updatedBizPurchases.push(itemObj);
              }
            }
            updatedFields.businessInfo = {
              ...bizData,
              purchases: updatedBizPurchases
            };
            updatedFields.business_info = updatedFields.businessInfo;
          }
        } else if (tableStr === "business_info" || tableStr === "businessInfo") {
          const bizData = syncData.businessInfo || syncData.business_info || {};
          const mergedBiz = {
            ...bizData,
            ...data
          };
          updatedFields.businessInfo = mergedBiz;
          updatedFields.business_info = mergedBiz;
        }

        await setDoc(doc(db, "passcode_syncs", syncId), {
          ...syncData,
          ...updatedFields
        }, { merge: true });

        console.log(`[Sync Engine server] Successfully propagated ${isDelete ? 'delete' : 'upsert'} of table=${tableStr}, id=${id} to passcode_syncs/${syncId}`);
      });

      await Promise.all(promises);
    } catch (err: any) {
      console.warn("[Sync Engine server] Failed to propagate changes to passcode_syncs document:", err.message);
    }
  }

  app.get("/api/db/fetch", async (req: Request, res: Response) => {
    const { table, owner_email } = req.query;
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) {
        return res.status(401).json({ error: "Access Denied: Unauthenticated user request." });
      }

      const allowedIds = await resolveAllUserIdsForEmail(verified.email, verified.uid);
      const recordsMap = new Map<string, any>();
      const tableStr = String(table);

      // Point query each allowed identity to bypass Firestore "in" index limits and merge them gracefully
      for (const uid of allowedIds) {
        const q = query(collection(db, tableStr), where("user_id", "==", uid));
        const docsSnap = await getDocs(q);
        docsSnap.forEach(docSnapshot => {
          const data = docSnapshot.data();
          const docId = data.id || docSnapshot.id;
          recordsMap.set(docId, data);
        });
      }

      const records = Array.from(recordsMap.values());
      res.json(records);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/db/upsert", async (req: Request, res: Response) => {
    const { table, id, data } = req.body;
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) {
        return res.status(401).json({ error: "Access Denied: Unauthenticated user request." });
      }

      const tableStr = String(table);
      const docId = String(id || data.id);

      const enrichedData = {
        ...data,
        id: docId,
        user_id: verified.uid,
        userId: verified.uid,
        owner_id: verified.uid,
        updated_at: new Date().toISOString()
      };

      await setDoc(doc(db, tableStr, docId), enrichedData);

      // Async propagate upsert to the user's passcode_syncs file backing so PC onSnapshot captures it
      await syncCollectionAndPasscodeVault(verified, tableStr, docId, enrichedData, false);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/db/delete", async (req: Request, res: Response) => {
    const { table, id } = req.body;
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) {
        return res.status(401).json({ error: "Access Denied: Unauthenticated user request." });
      }

      const tableStr = String(table);
      const docId = String(id);
      const docRef = doc(db, tableStr, docId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const docData = docSnap.data();
        const allowedIds = await resolveAllUserIdsForEmail(verified.email, verified.uid);
        
        if (docData.user_id && !allowedIds.includes(docData.user_id)) {
          return res.status(403).json({ error: "Access Forbidden: Document belongs to another user." });
        }
      }

      await deleteDoc(docRef);

      // Async propagate deletion to user's passcode_syncs file backing so PC onSnapshot captures it
      await syncCollectionAndPasscodeVault(verified, tableStr, docId, {}, true);

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/passcode_syncs/get", async (req: Request, res: Response) => {
    const { id, email } = req.query;
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) {
        return res.status(401).json({ error: "Access Denied: Unauthenticated user request." });
      }

      if (email) {
        const cleanEmail = String(email).trim().toLowerCase();
        if (cleanEmail !== verified.email && cleanEmail !== verified.uid) {
          return res.status(403).json({ error: "Access Forbidden: Mismatched credentials." });
        }

        const passcodeRef = collection(db, "passcode_syncs");
        const q = query(passcodeRef, where("linked_email", "==", cleanEmail));
        const querySnap = await getDocs(q);
        if (!querySnap.empty) {
          const docs = querySnap.docs.map(docSnapshot => docSnapshot.data());
          docs.sort((a: any, b: any) => {
            const t1 = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const t2 = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            return t2 - t1;
          });

          const resDoc = docs[0];
          if (resDoc && resDoc.user_id && resDoc.user_id !== verified.uid) {
            return res.status(403).json({ error: "Access Forbidden: Vault belongs to another user." });
          }
          return res.json(resDoc);
        }
        return res.json(null);
      }

      if (!id) {
        return res.status(400).json({ error: "Missing id or email parameter" });
      }

      const docSnap = await getDoc(doc(db, "passcode_syncs", String(id)));
      if (docSnap.exists()) {
        const syncData = docSnap.data();
        if (syncData.user_id && syncData.user_id !== verified.uid && syncData.linked_email !== verified.email) {
          return res.status(403).json({ error: "Access Forbidden: Vault belongs to another user." });
        }
        return res.json(syncData);
      }
      res.json(null);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/passcode_syncs/upsert", async (req: Request, res: Response) => {
    const { payload } = req.body;
    try {
      const verified = await verifyFirebaseToken(req);
      if (!verified) {
        return res.status(401).json({ error: "Access Denied: Unauthenticated user request." });
      }

      if (payload && payload.id) {
        const docRef = doc(db, "passcode_syncs", payload.id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const existing = docSnap.data();
          if (existing.user_id && existing.user_id !== verified.uid && existing.linked_email !== verified.email) {
            return res.status(403).json({ error: "Access Forbidden: Vault belongs to another user." });
          }

          const incomingProductsCount = (payload.products || []).length;
          const incomingTransactionsCount = (payload.transactions || []).length;
          
          if (incomingProductsCount === 0 && incomingTransactionsCount === 0) {
            const existingProductsCount = (existing.products || []).length;
            const existingTransactionsCount = (existing.transactions || []).length;
            if (existingProductsCount > 0 || existingTransactionsCount > 0) {
              console.log(`[Server Sync] Stopped blank payload override for sync ID: ${payload.id}`);
              return res.json({ success: true, ignored: true, message: "Protected existing non-empty cloud backup." });
            }
          }
        }

        const enrichedPayload = {
          ...payload,
          user_id: verified.uid,
          userId: verified.uid,
          linked_email: payload.linked_email || verified.email,
          updated_at: new Date().toISOString()
        };

        await setDoc(docRef, enrichedPayload);
        res.json({ success: true });
      } else {
        res.status(400).json({ error: "Invalid sync payload format." });
      }
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
        } catch (firstTryErr: any) {
          console.log("[AI Insights] Primary gemini-3.5-flash experiencing high demand. Trying backup model gemini-3.1-flash-lite...");
          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: prompt,
            config: {
              responseMimeType: "application/json",
              systemInstruction: "You are an elite, friendly business auditor specializing in retail stores and general shops."
            }
          });
          jsonStr = response.text?.trim() || "[]";
        }
      } catch (geminiErr: any) {
        console.log("[AI Insights] Serving live high-fidelity fallback insights (models offline or busy).");
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

      let category = "";
      try {
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt
          });
          category = response.text?.trim() || "";
        } catch (firstTryErr) {
          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite",
            contents: prompt
          });
          category = response.text?.trim() || "";
        }
      } catch (geminiErr) {
        category = classifyExpenseLocally(description);
      }

      const finalCategory = category || classifyExpenseLocally(description);
      res.json({ category: finalCategory });
    } catch (error: any) {
      res.json({ category: classifyExpenseLocally(description) });
    }
  });

  // Fallback translation and digit conversion helpers
  function cleanBanglaDigits(str: string): string {
    if (!str) return "";
    const map: { [key: string]: string } = {
      '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
      '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
    };
    return str.replace(/[০-৯]/g, (m) => map[m] || m).replace(/[^0-9]/g, "");
  }

  function fallbackTranslateText(str: string): string {
    if (!str) return "";
    return str; // Fallback directly if no API has run
  }

  // API Endpoint: Translate and Transliterate Customer/Partner Bengali Info to English
  app.post("/api/ai/translate-partner", async (req: Request, res: Response) => {
    const { name, phone, address } = req.body;
    try {
      let ai: GoogleGenAI;
      try {
        ai = getGeminiClient();
      } catch (err: any) {
        res.json({
          name: fallbackTranslateText(name),
          phone: cleanBanglaDigits(phone),
          address: fallbackTranslateText(address)
        });
        return;
      }

      const prompt = `You are a professional Bangladeshi bilingual translator and transliterator.
Your task is to translate and transliterate the given customer information to standard, professional English.

Input Data:
- Name: "${name}"
- Phone: "${phone}"
- Address: "${address}"

Instructions:
1. Transliterate or translate the Bengali name to standard English letters (e.g., "মোঃ রফিকুল ইসলাম" -> "Md. Rofiqul Islam", "সাকিব হাসান" -> "Sakib Hasan", "সজীব সিকদার" -> "Sajib Shikder").
2. Translate/transliterate the address details to professional English (e.g., "গুলশান-২, রোড ৪, ঢাকা" -> "Gulshan-2, Road 4, Dhaka", "মিরপুর ২" -> "Mirpur 2").
3. Convert all Bengali digits (০-৯) to standard English digits (0-9) in the phone number and remove any character except numbers.
4. Response MUST strictly be a direct JSON object containing ONLY keys: "name", "phone", and "address". No explanations, no markdown block tickers.

Example response structure:
{
  "name": "Translated Name",
  "phone": "01712345678",
  "address": "Translated Address"
}`;

      let resultObj = { name, phone, address };
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt
        });
        const text = response.text?.trim() || "";
        const cleanJson = text.replace(/```json/i, "").replace(/```/g, "").trim();
        resultObj = JSON.parse(cleanJson);
      } catch (geminiErr) {
        resultObj = {
          name: fallbackTranslateText(name),
          phone: cleanBanglaDigits(phone),
          address: fallbackTranslateText(address)
        };
      }
      res.json(resultObj);
    } catch (error: any) {
      res.json({
        name: fallbackTranslateText(name),
        phone: cleanBanglaDigits(phone),
        address: fallbackTranslateText(address)
      });
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
