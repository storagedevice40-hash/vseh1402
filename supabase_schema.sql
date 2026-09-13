-- ==========================================================================
-- VSEH PRO - SUPABASE DATABASE SCHEMA
-- ==========================================================================
-- INSTRUCTIONS:
-- 1. Open your Supabase Project Dashboard (https://supabase.com/dashboard)
-- 2. Click on "SQL Editor" in the left sidebar
-- 3. Click "New query"
-- 4. Paste this entire script and click "RUN" (or press Ctrl + Enter)
-- ==========================================================================

-- 1. STUDENTS TABLE
CREATE TABLE IF NOT EXISTS public.students (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    gender TEXT DEFAULT 'Male',
    class TEXT,
    phone TEXT,
    fee TEXT DEFAULT '0',
    join_date TEXT,
    shift TEXT DEFAULT 'Morning',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 2. PAYMENTS TABLE
CREATE TABLE IF NOT EXISTS public.payments (
    id TEXT PRIMARY KEY,
    student_id TEXT,
    student_name TEXT,
    class_name TEXT,
    phone TEXT,
    amount NUMERIC DEFAULT 0,
    month TEXT,
    date TEXT,
    mode TEXT DEFAULT 'CASH',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 3. ATTENDANCE TABLE
CREATE TABLE IF NOT EXISTS public.attendance (
    id TEXT PRIMARY KEY,
    student_id TEXT,
    student_name TEXT,
    class TEXT,
    date TEXT,
    month TEXT,
    status TEXT DEFAULT 'Present',
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 4. CLASS FEES TABLE
CREATE TABLE IF NOT EXISTS public.class_fees (
    class_name TEXT PRIMARY KEY,
    fee_amount TEXT DEFAULT '0',
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 5. SETTINGS TABLE (Dynamic WhatsApp Instance & Token, etc.)
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- 6. ARCHIVED STUDENTS TABLE (Backup of deleted students)
CREATE TABLE IF NOT EXISTS public.archived_students (
    id TEXT PRIMARY KEY,
    name TEXT,
    gender TEXT,
    class TEXT,
    phone TEXT,
    fee TEXT,
    join_date TEXT,
    shift TEXT,
    deleted_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

-- ==========================================================================
-- DISABLE RLS (Allows backend API to read/write without restriction)
-- ==========================================================================
ALTER TABLE public.students DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_fees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.archived_students DISABLE ROW LEVEL SECURITY;

-- ==========================================================================
-- INITIAL DEFAULT DATA (Pre-seeds default classes and WhatsApp settings)
-- ==========================================================================

-- Pre-seed default WhatsApp settings (Can be edited from Web UI Settings anytime)
INSERT INTO public.settings (key, value)
VALUES ('waSettings', '{"instanceId":"instance185113","token":"twqlatgvyyd501x8"}')
ON CONFLICT (key) DO NOTHING;

-- Pre-seed default Class Fees
INSERT INTO public.class_fees (class_name, fee_amount) VALUES
('Morning - 9th', '500'),
('Morning - 10th', '600'),
('Morning - 11th', '700'),
('Morning - 12th', '800'),
('Evening - 9th', '500'),
('Evening - 10th', '600'),
('Evening - 11th', '700'),
('Evening - 12th', '800')
ON CONFLICT (class_name) DO NOTHING;
