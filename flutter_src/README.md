# Barakah Bill Pro - Smart Electronics Billing App (Bangladesh)
## Expert Flutter + Supabase Architecture Documentation

This directory contains the production-ready clean modular Flutter codebase with real-time Supabase state synchronization and localized logic designed specifically for retail electronics shops in Bangladesh.

---

### 📂 Directory Architecture

```
/flutter_src
├── README.md               <-- Setup instructions, workflow details & architecture
├── supabase_schema.sql     <-- Core SQL entities, RLS policies, and triggers
├── main.dart               <-- App initialization pipeline
├── models.dart             <-- Standard dynamic typed business models
├── supabase_service.dart   <-- Core Supabase client query methods
├── billing_provider.dart   <-- Reactive state management system
└── ui_screens.dart         <-- High-security custom UI layouts and dashboard views
```

---

### 🏗️ Getting Started in Flutter

#### 1. Add Dependencies (`pubspec.yaml`)
Include these standard libraries in your Flutter project configuration:
```yaml
dependencies:
  flutter:
    sdk: flutter
  supabase_flutter: ^2.6.0     # Official Supabase Client SDK
  provider: ^6.1.1             # Clean state management
  signature: ^5.4.0            # Signature pad canvas capturing
  intl: ^0.19.0                # Language localization and currency formats
```

#### 2. Execute SQL Database Setup
Open the **SQL Editor** in your Supabase Dashboard, copy and run the contents of `supabase_schema.sql`. This will:
* Build the primary tables for `profiles`, `products`, `customers`, `purchases`, `expenses`, `transactions`, and `transaction_items` with Row-Level Security (RLS) policies.
* Compile the dynamic DB view `view_financial_overview` for net profits tracking.
* Set up the essential Postgres Trigger `trg_recalculate_profit_on_purchase` that automatically synchronizes cost prices of historical "Minus Stock Sales" when fresh purchase orders are logged!

---

### 💸 Business Logic Implementation Details

#### 1. Out-of-stock (Negative Stock) dynamic adjustments
* When a cashier adds items to card and checkout, the app flags individual sold lines as `is_negative_sale = true` if the current product stock is less than the checkout quantity.
* A transaction item row commits with the sold price and the *assumed unit purchase price* (which was currently estimated as `products.buy_price`).
* Later, when the admin updates purchase records in the `purchases` table, Postgres instantly matches this product's unreconciled items. It sets their historic transaction `cost_price` to check against the real-purchase `buy_price` cost, recalculating the `net_profit` flawlessly across the dashboard reports.

#### 2. Localized Bangladesh elements
* **Currency Symbol**: Supports the BDT `৳` symbol.
* **In-Words Conversions**: Simple algorithms in `BillingProvider.convertToWords(double amt)` translate numbers to text (e.g. `1,25,000.00` becomes `"One Lakh Twenty Five Thousand Taka Only"`) ensuring complete local compliant layouts.
