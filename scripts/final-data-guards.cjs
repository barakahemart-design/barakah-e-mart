const fs = require('fs');
const path = require('path');

const helperFile = path.join(process.cwd(), 'src', 'lib', 'firebase-helpers.ts');
let source = fs.readFileSync(helperFile, 'utf8');
const original = source;

// Recovery must never resurrect records explicitly deleted by the user.
const recoveryMarker = "    // Read the complete current collection once and filter by the authenticated account.";
const recoveryGuard = `    // Permanent-delete guard: old vault/legacy copies must not resurrect deleted records.\n    const deletedKeys = new Set<string>();\n    try {\n      const deletedSnap = await getDocs(collection(db, 'deleted_records'));\n      deletedSnap.docs.forEach(d => {\n        const x: any = d.data() || {};\n        const c = String(x.collection || '').trim();\n        const id = String(x.record_id || x.id || '').trim();\n        if (c && id) deletedKeys.add(c + '__' + id);\n      });\n    } catch (deletedErr) {\n      console.warn('[Cloud Restore] Deleted-record guard read warning:', deletedErr);\n    }\n\n    const isDeleted = (collectionName: string, row: any) => {\n      const id = String(row?.id || '').trim();\n      return !!id && deletedKeys.has(collectionName + '__' + id);\n    };\n\n    // Read the complete current collection once and filter by the authenticated account.`;
source = source.replace(recoveryMarker, recoveryGuard);

// Filter collection rows before they can be canonicalized.
source = source.replace(
  "        if (rows.length > 0) {",
  "        const liveRows = rows.filter((row: any) => !isDeleted(collectionName, row));\n\n        if (liveRows.length > 0) {"
);
source = source.replace("result.transactions = rows;", "result.transactions = liveRows;");
source = source.replace("result[resultKey] = rows;", "result[resultKey] = liveRows;");

// Filter vault-derived rows too, before canonical writes/local restore.
const beforeCanonical = "    // Canonicalize recovered rows back into the current account identity. Merge only.";
const filterBeforeCanonical = `    result.products = (Array.isArray(result.products) ? result.products : []).filter((row: any) => !isDeleted('products', row));\n    result.contacts = (Array.isArray(result.contacts) ? result.contacts : []).filter((row: any) => !isDeleted('customers', row));\n    result.expenses = (Array.isArray(result.expenses) ? result.expenses : []).filter((row: any) => !isDeleted('expenses', row));\n    result.purchases = (Array.isArray(result.purchases) ? result.purchases : []).filter((row: any) => !isDeleted('purchases', row));\n    result.transactions = (Array.isArray(result.transactions) ? result.transactions : []).filter((row: any) => !isDeleted('transactions', row));\n\n    // Canonicalize recovered rows back into the current account identity. Merge only.`;
source = source.replace(beforeCanonical, filterBeforeCanonical);

if (source !== original) fs.writeFileSync(helperFile, source, 'utf8');
console.log('Final data guards applied.');
