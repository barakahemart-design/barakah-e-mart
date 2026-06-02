-- =========================================================================
-- COMPLETE A-TO-Z CLEAN SUPABASE DATABASE SCHEMA
-- Smart Electronics Billing App for Bangladesh (Barakah Bill Pro)
-- =========================================================================

-- Enable UUID generation extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================================================================
-- STEP 1: DROP OLD INCOMPATIBLE STRUCTURES (Wipes legacy mismatched columns)
-- =========================================================================
DROP VIEW IF EXISTS public.view_financial_overview CASCADE;

DROP TABLE IF EXISTS public.expenses CASCADE;
DROP TABLE IF EXISTS public.transaction_items CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.purchases CASCADE;
DROP TABLE IF EXISTS public.products CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- =========================================================================
-- STEP 2: CREATE PURE UUID-MAPPED TABLES
-- =========================================================================

-- 1. PROFILES & USER SPECS
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    shop_name TEXT DEFAULT 'Barakah Electronics',
    shop_address TEXT DEFAULT 'Dhaka, Bangladesh',
    support_phone TEXT DEFAULT '01700-000000',
    vat_reg_id TEXT DEFAULT 'VAT-884499',
    admin_passcode_hash TEXT DEFAULT '1234',
    sales_passcode_hash TEXT DEFAULT '5555',
    admin_panel_password TEXT DEFAULT '1234',
    sales_panel_password TEXT DEFAULT '5555',
    currency_symbol TEXT DEFAULT '৳',
    company_logo_url TEXT,
    show_logo_in_invoice BOOLEAN DEFAULT TRUE,
    terms_conditions TEXT DEFAULT '1. Warranty requires original invoice.\n2. Replacement within 7 days only.',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. CUSTOMERS
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. PRODUCTS
CREATE TABLE public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    sku TEXT,
    category TEXT DEFAULT 'Electronics',
    buy_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    sell_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    stock NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    unit TEXT DEFAULT 'piece',
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. PURCHASES (Inventory Restocking)
CREATE TABLE public.purchases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    invoice_no TEXT NOT NULL,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    buy_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. SALES TRANSACTIONS (Invoices)
CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    invoice_no TEXT NOT NULL UNIQUE,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    vat_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'Cash',
    signature_svg TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. SALES TRANSACTION LINE ITEMS
CREATE TABLE public.transaction_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    quantity NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    sell_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    cost_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    is_negative_sale BOOLEAN DEFAULT FALSE
);

-- 7. EXPENSES LEDGER
CREATE TABLE public.expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    category TEXT DEFAULT 'Others',
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- STEP 3: AUTOMATIC PROFIT RECALCULATION TRIGGERS
-- =========================================================================

CREATE OR REPLACE FUNCTION public.recalculate_profit_on_purchase_sync()
RETURNS TRIGGER AS $$
BEGIN
    -- 1. Update the Product cost to reflect the latest buy rate or standard rate
    UPDATE public.products
    SET buy_price = NEW.buy_price,
        stock = stock + (CASE WHEN TG_OP = 'INSERT' THEN NEW.quantity 
                              WHEN TG_OP = 'UPDATE' THEN (NEW.quantity - OLD.quantity)
                              ELSE 0 END)
    WHERE id = NEW.product_id;

    -- 2. Find unreconciled transaction items that were flagged as negative sales and update cost_price
    UPDATE public.transaction_items
    SET cost_price = NEW.buy_price
    WHERE product_id = NEW.product_id 
      AND is_negative_sale = TRUE;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_recalculate_profit_on_purchase
AFTER INSERT OR UPDATE ON public.purchases
FOR EACH ROW EXECUTE FUNCTION public.recalculate_profit_on_purchase_sync();

-- =========================================================================
-- STEP 4: DYNAMIC NET PROFIT computation (VIEW)
-- =========================================================================

CREATE OR REPLACE VIEW public.view_financial_overview AS
SELECT 
    p.id as owner_id,
    COALESCE(SUM(ti.quantity * ti.sell_price), 0) as raw_sales,
    COALESCE((SELECT SUM(discount) FROM public.transactions t WHERE t.user_id = p.id), 0) as total_discounts,
    COALESCE(SUM(ti.quantity * ti.cost_price), 0) as total_cogs,
    COALESCE((SELECT SUM(amount) FROM public.expenses e WHERE e.user_id = p.id), 0) as total_expenses,
    (
        COALESCE(SUM(ti.quantity * ti.sell_price), 0) - 
        COALESCE((SELECT SUM(discount) FROM public.transactions t WHERE t.user_id = p.id), 0) -
        COALESCE(SUM(ti.quantity * ti.cost_price), 0) -
        COALESCE((SELECT SUM(amount) FROM public.expenses e WHERE e.user_id = p.id), 0)
    ) as net_profit
FROM public.profiles p
LEFT JOIN public.transaction_items ti ON ti.user_id = p.id
GROUP BY p.id;

-- =========================================================================
-- STEP 5: ROW LEVEL SECURITY & POLICY ENGINE
-- =========================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own profile" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can manage own customers" ON public.customers FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own products" ON public.products FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own purchases" ON public.purchases FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own transactions" ON public.transactions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own transaction items" ON public.transaction_items FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own expenses" ON public.expenses FOR ALL USING (auth.uid() = user_id);

-- =========================================================================
-- STEP 6: BACKUP & PIN PASSTHROUGH (passcode_syncs JSON STORAGE BODY)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.passcode_syncs (
    id TEXT PRIMARY KEY,
    linked_email TEXT NOT NULL,
    products JSONB DEFAULT '[]'::jsonb,
    contacts JSONB DEFAULT '[]'::jsonb,
    expenses JSONB DEFAULT '[]'::jsonb,
    transactions JSONB DEFAULT '[]'::jsonb,
    business_info JSONB DEFAULT '{}'::jsonb,
    businessInfo JSONB DEFAULT '{}'::jsonb,
    purchases JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for passcode syncs
ALTER TABLE public.passcode_syncs ENABLE ROW LEVEL SECURITY;

-- Anonymous/registered users need read/write access to sync rows via direct client interaction or Express proxy.
-- This ensures background PIN flow devices can fetch & upload backups effortlessly.
CREATE POLICY "Allow public read/write access to passcode_syncs" ON public.passcode_syncs 
    FOR ALL USING (true) WITH CHECK (true);
