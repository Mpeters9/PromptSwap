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
