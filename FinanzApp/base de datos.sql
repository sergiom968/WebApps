-- ══════════════════════════════════════════════════════════════════════
-- FINANZAPP — ESQUEMA COMPLETO ACTUALIZADO
-- Versión final incluyendo todos los cambios del desarrollo.
-- 
-- Para BD nueva:        ejecuta todo el archivo completo.
-- Para BD existente:    ejecuta solo el bloque "MIGRACIÓN INCREMENTAL"
--                       al final del archivo.
-- ══════════════════════════════════════════════════════════════════════


-- ──────────────────────────────────────────────────────────────────────
-- TABLAS (orden respeta dependencias de foreign keys)
-- ──────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.categories (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  type       text        NOT NULL CHECK (type = ANY (ARRAY['income','expense'])),
  icon       text        NOT NULL DEFAULT '📦',
  color      text        NOT NULL DEFAULT '#6b7280',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.accounts (
  id         uuid        NOT NULL DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  bank       text        NOT NULL,
  type       text        NOT NULL DEFAULT 'ahorros'
                         CHECK (type = ANY (ARRAY['ahorros','efectivo'])),
  balance    numeric     NOT NULL DEFAULT 0,
  color      text        NOT NULL DEFAULT '#3b82f6',
  icon       text        NOT NULL DEFAULT '🏦',
  archived   boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT accounts_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.credit_cards (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  name            text        NOT NULL,
  bank            text        NOT NULL,
  brand           text        NOT NULL DEFAULT 'Visa'
                              CHECK (brand = ANY (ARRAY['Visa','MasterCard','Amex','Other'])),
  credit_limit    numeric     NOT NULL DEFAULT 0,
  current_balance numeric     NOT NULL DEFAULT 0,
  closing_day     smallint    CHECK (closing_day BETWEEN 1 AND 31),
  due_day         smallint    CHECK (due_day     BETWEEN 1 AND 31),
  color           text        NOT NULL DEFAULT '#7c3aed',
  archived        boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT credit_cards_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.debts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),

  -- Dirección: 'owe' = yo debo | 'owed' = me deben
  direction text NOT NULL DEFAULT 'owe'
    CHECK (direction = ANY (ARRAY['owe','owed'])),

  name text NOT NULL,

  -- Acreedor (yo debo) o deudor (me deben). Nullable para 'owed'.
  creditor text,

  -- Tipo de deuda. Solo aplica para direction = 'owe'.
  type text
    CHECK (type = ANY (ARRAY['loan','credit','personal','mortgage','other'])),

  total_amount     numeric NOT NULL CHECK (total_amount > 0),
  remaining_amount numeric NOT NULL DEFAULT 0,
  interest_rate    numeric NOT NULL DEFAULT 0,

  -- Cuota mensual configurada (sustituye el cálculo automático por tasa).
  monthly_payment  numeric NOT NULL DEFAULT 0,

  -- Día del mes en que cae el pago (1-31).
  -- Genera entrada virtual en la sección de recurrentes.
  payment_day smallint CHECK (payment_day BETWEEN 1 AND 31),

  -- ── Campos para direction = 'owe' ──────────────────────────────────
  -- Categoría para registrar el abono a capital en transacciones.
  capital_category_id uuid REFERENCES public.categories(id),
  -- Categoría para registrar los intereses en transacciones.
  interest_category_id uuid REFERENCES public.categories(id),
  -- Cuenta de pago pre-seleccionada en el modal "Verificar y pagar".
  default_account_id uuid REFERENCES public.accounts(id),
  -- Mes del último pago registrado (formato 'YYYY-MM').
  -- Oculta la deuda del widget de recurrentes hasta el mes siguiente.
  last_paid_month text,

  -- ── Campos para direction = 'owed' ─────────────────────────────────
  -- Cuenta donde se acredita el ingreso al registrar un cobro.
  income_account_id uuid REFERENCES public.accounts(id),
  -- Categoría del ingreso generado al cobrar.
  income_category_id uuid REFERENCES public.categories(id),

  -- ── Campos comunes ──────────────────────────────────────────────────
  due_date   date,
  status     text NOT NULL DEFAULT 'active'
             CHECK (status = ANY (ARRAY['active','paid','negotiating'])),
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT debts_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.recurring_expenses (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  amount      numeric     NOT NULL CHECK (amount > 0),
  frequency   text        NOT NULL DEFAULT 'monthly'
              CHECK (frequency = ANY (ARRAY['monthly','weekly','biweekly','yearly'])),
  day         smallint    CHECK (day BETWEEN 1 AND 31),
  category_id uuid        REFERENCES public.categories(id),
  account_id  uuid        REFERENCES public.accounts(id),
  card_id     uuid        REFERENCES public.credit_cards(id),
  icon        text        NOT NULL DEFAULT '🔁',
  next_date   date,
  auto_charge boolean     NOT NULL DEFAULT false,
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recurring_expenses_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.budgets (
  id          uuid        NOT NULL DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  category_id uuid        REFERENCES public.categories(id),
  amount      numeric     NOT NULL CHECK (amount > 0),
  period      text        NOT NULL DEFAULT 'monthly'
              CHECK (period = ANY (ARRAY['monthly','yearly'])),
  month       smallint    CHECK (month BETWEEN 1 AND 12),
  year        smallint,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budgets_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.savings_goals (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  name           text        NOT NULL,
  target_amount  numeric     NOT NULL CHECK (target_amount > 0),
  current_amount numeric     NOT NULL DEFAULT 0,
  deadline       date,
  icon           text        NOT NULL DEFAULT '🎯',
  color          text        NOT NULL DEFAULT '#22c55e',
  status         text        NOT NULL DEFAULT 'active'
                             CHECK (status = ANY (ARRAY['active','completed','paused'])),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT savings_goals_pkey PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id             uuid        NOT NULL DEFAULT gen_random_uuid(),
  type           text        NOT NULL
                             CHECK (type = ANY (ARRAY['income','expense','transfer'])),
  amount         numeric     NOT NULL CHECK (amount > 0),
  description    text        NOT NULL,
  date           date        NOT NULL DEFAULT CURRENT_DATE,
  category_id    uuid        REFERENCES public.categories(id),
  account_id     uuid        REFERENCES public.accounts(id),
  credit_card_id uuid        REFERENCES public.credit_cards(id),
  transfer_to_id uuid        REFERENCES public.accounts(id),
  -- Referencia a la deuda asociada (abono capital, intereses, cobro me-deben)
  debt_id        uuid        REFERENCES public.debts(id),
  -- true cuando es pago de tarjeta de crédito (se excluye de gastos del mes)
  is_card_payment boolean    NOT NULL DEFAULT false,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transactions_pkey PRIMARY KEY (id)
);


-- ──────────────────────────────────────────────────────────────────────
-- ÍNDICES
-- ──────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_debts_direction           ON public.debts(direction);
CREATE INDEX IF NOT EXISTS idx_debts_status              ON public.debts(status);
CREATE INDEX IF NOT EXISTS idx_debts_payment_day         ON public.debts(payment_day);
CREATE INDEX IF NOT EXISTS idx_debts_last_paid_month     ON public.debts(last_paid_month);
CREATE INDEX IF NOT EXISTS idx_debts_capital_cat         ON public.debts(capital_category_id);
CREATE INDEX IF NOT EXISTS idx_debts_interest_cat        ON public.debts(interest_category_id);
CREATE INDEX IF NOT EXISTS idx_debts_income_cat          ON public.debts(income_category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_debt_id      ON public.transactions(debt_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date         ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type         ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_account      ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_recurring_active_next     ON public.recurring_expenses(active, next_date);
CREATE INDEX IF NOT EXISTS idx_accounts_archived         ON public.accounts(archived);
CREATE INDEX IF NOT EXISTS idx_credit_cards_archived     ON public.credit_cards(archived);


-- ══════════════════════════════════════════════════════════════════════
-- MIGRACIÓN INCREMENTAL
-- Si ya tienes una BD existente ejecuta SOLO este bloque.
-- Cada sentencia usa IF NOT EXISTS o bloques DO para ser idempotente.
-- ══════════════════════════════════════════════════════════════════════

-- ── debts: columnas nuevas ────────────────────────────────────────────

ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS direction text NOT NULL DEFAULT 'owe'
  CHECK (direction = ANY (ARRAY['owe','owed']));

ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS monthly_payment numeric NOT NULL DEFAULT 0;

ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS payment_day smallint
  CHECK (payment_day BETWEEN 1 AND 31);

ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS capital_category_id uuid
  REFERENCES public.categories(id);

ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS interest_category_id uuid
  REFERENCES public.categories(id);

ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS default_account_id uuid
  REFERENCES public.accounts(id);

ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS last_paid_month text;

ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS income_account_id uuid
  REFERENCES public.accounts(id);

ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS income_category_id uuid
  REFERENCES public.categories(id);

-- creditor pasa a ser nullable (no aplica para direction = 'owed')
DO $$ BEGIN
  ALTER TABLE public.debts ALTER COLUMN creditor DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END$$;

-- type pasa a ser nullable (no aplica para direction = 'owed')
DO $$ BEGIN
  ALTER TABLE public.debts ALTER COLUMN type DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END$$;

-- ── transactions: columnas nuevas ────────────────────────────────────

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS debt_id uuid
  REFERENCES public.debts(id);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS is_card_payment boolean NOT NULL DEFAULT false;

-- ── recurring_expenses: columna nueva ────────────────────────────────

ALTER TABLE public.recurring_expenses
  ADD COLUMN IF NOT EXISTS card_id uuid
  REFERENCES public.credit_cards(id);

-- ── índices (idempotentes) ───────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_debts_direction           ON public.debts(direction);
CREATE INDEX IF NOT EXISTS idx_debts_status              ON public.debts(status);
CREATE INDEX IF NOT EXISTS idx_debts_payment_day         ON public.debts(payment_day);
CREATE INDEX IF NOT EXISTS idx_debts_last_paid_month     ON public.debts(last_paid_month);
CREATE INDEX IF NOT EXISTS idx_debts_capital_cat         ON public.debts(capital_category_id);
CREATE INDEX IF NOT EXISTS idx_debts_interest_cat        ON public.debts(interest_category_id);
CREATE INDEX IF NOT EXISTS idx_debts_income_cat          ON public.debts(income_category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_debt_id      ON public.transactions(debt_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date         ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_type         ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_account      ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_recurring_active_next     ON public.recurring_expenses(active, next_date);
CREATE INDEX IF NOT EXISTS idx_accounts_archived         ON public.accounts(archived);
CREATE INDEX IF NOT EXISTS idx_credit_cards_archived     ON public.credit_cards(archived);


-- ──────────────────────────────────────────────────────────────────────
-- VERIFICACIÓN FINAL
-- ──────────────────────────────────────────────────────────────────────

SELECT
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('debts','transactions','recurring_expenses')
ORDER BY table_name, ordinal_position;