-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bank text NOT NULL,
  type text NOT NULL DEFAULT 'ahorros'::text CHECK (type = ANY (ARRAY['ahorros'::text, 'efectivo'::text])),
  balance numeric NOT NULL DEFAULT 0,
  color text NOT NULL DEFAULT '#3b82f6'::text,
  icon text NOT NULL DEFAULT '🏦'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  archived boolean NOT NULL DEFAULT false,
  CONSTRAINT accounts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.budgets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category_id uuid,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  period text NOT NULL DEFAULT 'monthly'::text CHECK (period = ANY (ARRAY['monthly'::text, 'yearly'::text])),
  month smallint CHECK (month >= 1 AND month <= 12),
  year smallint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT budgets_pkey PRIMARY KEY (id),
  CONSTRAINT budgets_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['income'::text, 'expense'::text])),
  icon text NOT NULL DEFAULT '📦'::text,
  color text NOT NULL DEFAULT '#6b7280'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.credit_cards (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bank text NOT NULL,
  brand text NOT NULL DEFAULT 'Visa'::text CHECK (brand = ANY (ARRAY['Visa'::text, 'MasterCard'::text, 'Amex'::text, 'Other'::text])),
  credit_limit numeric NOT NULL DEFAULT 0,
  current_balance numeric NOT NULL DEFAULT 0,
  closing_day smallint CHECK (closing_day >= 1 AND closing_day <= 31),
  due_day smallint CHECK (due_day >= 1 AND due_day <= 31),
  color text NOT NULL DEFAULT '#7c3aed'::text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  archived boolean NOT NULL DEFAULT false,
  CONSTRAINT credit_cards_pkey PRIMARY KEY (id)
);
CREATE TABLE public.debts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  creditor text NOT NULL,
  type text NOT NULL DEFAULT 'loan'::text CHECK (type = ANY (ARRAY['loan'::text, 'credit'::text, 'personal'::text, 'mortgage'::text, 'other'::text])),
  total_amount numeric NOT NULL CHECK (total_amount > 0::numeric),
  remaining_amount numeric NOT NULL DEFAULT 0,
  interest_rate numeric NOT NULL DEFAULT 0,
  monthly_payment numeric NOT NULL DEFAULT 0,
  due_date date,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'paid'::text, 'negotiating'::text])),
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT debts_pkey PRIMARY KEY (id)
);
CREATE TABLE public.recurring_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  frequency text NOT NULL DEFAULT 'monthly'::text CHECK (frequency = ANY (ARRAY['monthly'::text, 'weekly'::text, 'biweekly'::text, 'yearly'::text])),
  day smallint CHECK (day >= 1 AND day <= 31),
  category_id uuid,
  account_id uuid,
  card_id uuid,
  icon text NOT NULL DEFAULT '🔁'::text,
  next_date date,
  auto_charge boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT recurring_expenses_pkey PRIMARY KEY (id),
  CONSTRAINT recurring_expenses_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT recurring_expenses_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id),
  CONSTRAINT recurring_expenses_card_id_fkey FOREIGN KEY (card_id) REFERENCES public.credit_cards(id)
);
CREATE TABLE public.savings_goals (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  target_amount numeric NOT NULL CHECK (target_amount > 0::numeric),
  current_amount numeric NOT NULL DEFAULT 0,
  deadline date,
  icon text NOT NULL DEFAULT '🎯'::text,
  color text NOT NULL DEFAULT '#22c55e'::text,
  status text NOT NULL DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'paused'::text])),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT savings_goals_pkey PRIMARY KEY (id)
);
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type = ANY (ARRAY['income'::text, 'expense'::text, 'transfer'::text])),
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  description text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  category_id uuid,
  account_id uuid,
  credit_card_id uuid,
  transfer_to_id uuid,
  debt_id uuid,
  is_card_payment boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT transactions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id),
  CONSTRAINT transactions_credit_card_id_fkey FOREIGN KEY (credit_card_id) REFERENCES public.credit_cards(id),
  CONSTRAINT transactions_transfer_to_id_fkey FOREIGN KEY (transfer_to_id) REFERENCES public.accounts(id),
  CONSTRAINT transactions_debt_id_fkey FOREIGN KEY (debt_id) REFERENCES public.debts(id)
);