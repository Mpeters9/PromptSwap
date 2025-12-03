-- Enable UUID generation functions.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Stores the main prompt listings with pricing, visibility, and metadata.
CREATE TABLE public.prompts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users (id),
  title text NOT NULL,
  description text,
  tags text[],
  price numeric(10,2),
  prompt_text text NOT NULL,
  preview_image text,
  is_public boolean DEFAULT false,
  version integer DEFAULT 1,
  created_at timestamp DEFAULT now()
);

CREATE INDEX idx_prompts_user_id ON public.prompts (user_id);
CREATE INDEX idx_prompts_public ON public.prompts (is_public);
CREATE INDEX idx_prompts_tags ON public.prompts USING GIN (tags);

-- Tracks edits and historical versions of prompts for auditing and rollback.
CREATE TABLE public.prompt_versions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id uuid REFERENCES public.prompts (id),
  user_id uuid REFERENCES auth.users (id),
  content text,
  notes text,
  created_at timestamp DEFAULT now()
);

CREATE INDEX idx_prompt_versions_prompt_id ON public.prompt_versions (prompt_id);
CREATE INDEX idx_prompt_versions_user_id ON public.prompt_versions (user_id);

-- Captures user ratings and feedback left on prompts.
CREATE TABLE public.prompt_ratings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id uuid REFERENCES public.prompts (id),
  user_id uuid REFERENCES auth.users (id),
  rating int,
  comment text,
  created_at timestamp
);

CREATE INDEX idx_prompt_ratings_prompt_id ON public.prompt_ratings (prompt_id);
CREATE INDEX idx_prompt_ratings_user_id ON public.prompt_ratings (user_id);

-- Records sales transactions for prompts, including Stripe transaction linkage.
CREATE TABLE public.prompt_sales (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id uuid REFERENCES public.prompts (id),
  buyer_id uuid REFERENCES auth.users (id),
  seller_id uuid REFERENCES auth.users (id),
  amount numeric(10,2),
  stripe_txn_id text,
  created_at timestamp
);

CREATE INDEX idx_prompt_sales_prompt_id ON public.prompt_sales (prompt_id);
CREATE INDEX idx_prompt_sales_buyer_id ON public.prompt_sales (buyer_id);
CREATE INDEX idx_prompt_sales_seller_id ON public.prompt_sales (seller_id);
CREATE INDEX idx_prompt_sales_txn_id ON public.prompt_sales (stripe_txn_id);

ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY prompts_select_public_or_owner_or_service
  ON public.prompts FOR SELECT
  USING (is_public = true OR auth.uid() = user_id OR auth.role() = 'service_role');
CREATE POLICY prompts_insert_owner_or_service
  ON public.prompts FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.role() = 'service_role');
CREATE POLICY prompts_update_owner_or_service
  ON public.prompts FOR UPDATE
  USING (auth.uid() = user_id OR auth.role() = 'service_role');
CREATE POLICY prompts_delete_owner_or_service
  ON public.prompts FOR DELETE
  USING (auth.uid() = user_id OR auth.role() = 'service_role');

-- Purchases policies
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY purchases_select_buyer_seller_or_service
  ON public.purchases FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR auth.role() = 'service_role');
CREATE POLICY purchases_insert_service_only
  ON public.purchases FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY purchases_update_service_only
  ON public.purchases FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY purchases_delete_service_only
  ON public.purchases FOR DELETE
  USING (auth.role() = 'service_role');

-- Logs processed Stripe events for idempotency.
CREATE TABLE public.stripe_events (
  event_id text PRIMARY KEY,
  type text,
  created_at timestamptz DEFAULT now()
);

CREATE POLICY stripe_events_insert_service ON public.stripe_events FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY stripe_events_select_service ON public.stripe_events FOR SELECT USING (auth.role() = 'service_role');
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;

-- Records payouts made to sellers (manual or automatic).
CREATE TABLE public.payouts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id uuid NOT NULL REFERENCES auth.users (id),
  amount numeric(10,2) NOT NULL,
  currency text DEFAULT 'usd',
  stripe_transfer_id text,
  destination_account text,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_payouts_transfer_id ON public.payouts (stripe_transfer_id);
CREATE INDEX idx_payouts_seller_id ON public.payouts (seller_id);

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY payouts_select_self ON public.payouts FOR SELECT USING (auth.uid() = seller_id);
CREATE POLICY payouts_select_service ON public.payouts FOR SELECT USING (auth.role() = 'service_role');
CREATE POLICY payouts_insert_service ON public.payouts FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY payouts_update_service ON public.payouts FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY payouts_delete_service ON public.payouts FOR DELETE USING (auth.role() = 'service_role');

-- Profiles protections (credits and Stripe fields)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_select_self_or_service
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR auth.role() = 'service_role');
CREATE POLICY profiles_update_service_only
  ON public.profiles FOR UPDATE
  USING (auth.role() = 'service_role');
CREATE POLICY profiles_insert_service_only
  ON public.profiles FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Prompt sales policies
ALTER TABLE public.prompt_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY prompt_sales_select_buyer_seller_or_service
  ON public.prompt_sales FOR SELECT
  USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR auth.role() = 'service_role');
CREATE POLICY prompt_sales_insert_service_only
  ON public.prompt_sales FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY prompt_sales_update_service_only
  ON public.prompt_sales FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
CREATE POLICY prompt_sales_delete_service_only
  ON public.prompt_sales FOR DELETE
  USING (auth.role() = 'service_role');

-- Manages prompt swap offers between users and their statuses.
CREATE TABLE public.swaps (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id uuid,
  responder_id uuid,
  requested_prompt_id uuid,
  offered_prompt_id uuid,
  status text DEFAULT 'pending',
  created_at timestamp
);

CREATE INDEX idx_swaps_requester_id ON public.swaps (requester_id);
CREATE INDEX idx_swaps_responder_id ON public.swaps (responder_id);
CREATE INDEX idx_swaps_requested_prompt_id ON public.swaps (requested_prompt_id);
CREATE INDEX idx_swaps_offered_prompt_id ON public.swaps (offered_prompt_id);
CREATE INDEX idx_swaps_status ON public.swaps (status);

-- Logs test runs of prompts with inputs, outputs, and model metadata.
CREATE TABLE public.test_runs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  prompt_id uuid,
  user_id uuid,
  input_data jsonb,
  output_data jsonb,
  model_used text,
  created_at timestamp
);

CREATE INDEX idx_test_runs_prompt_id ON public.test_runs (prompt_id);
CREATE INDEX idx_test_runs_user_id ON public.test_runs (user_id);
