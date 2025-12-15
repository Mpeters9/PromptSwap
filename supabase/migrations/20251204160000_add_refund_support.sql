-- Add refund support to purchases table
ALTER TABLE public.purchases 
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT NOT NULL,
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'refunded', 'partially_refunded', 'failed', 'disputed')),
ADD COLUMN IF NOT EXISTS amount_total DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'usd',
ADD COLUMN IF NOT EXISTS refunded_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS refund_reason TEXT,
ADD COLUMN IF NOT EXISTS last_stripe_event_id TEXT;

-- Create stripe_events table for idempotency
CREATE TABLE IF NOT EXISTS public.stripe_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  livemode BOOLEAN DEFAULT false,
  payload_hash TEXT,
  request_id TEXT,
  UNIQUE(event_id)
);

CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON public.stripe_events (event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_processed_at ON public.stripe_events (processed_at);


-- Create refund_requests table for tracking refund requests
CREATE TABLE IF NOT EXISTS public.refund_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID NOT NULL REFERENCES public.purchases (id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  requested_amount DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'processing', 'completed')),
  admin_id UUID REFERENCES auth.users (id),
  admin_reason TEXT,
  stripe_refund_id TEXT,
  final_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_purchase_id ON public.refund_requests (purchase_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_user_id ON public.refund_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON public.refund_requests (status);
CREATE INDEX IF NOT EXISTS idx_refund_requests_admin_id ON public.refund_requests (admin_id);

-- Create refunds table for detailed tracking
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID NOT NULL REFERENCES public.purchases (id) ON DELETE CASCADE,
  stripe_refund_id TEXT NOT NULL UNIQUE,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'canceled')),
  stripe_created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_stripe_event_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_refunds_purchase_id ON public.refunds (purchase_id);
CREATE INDEX IF NOT EXISTS idx_refunds_stripe_id ON public.refunds (stripe_refund_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds (status);

-- Enable RLS on new tables
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- RLS policies for stripe_events (service role only)
CREATE POLICY "Service role can manage stripe events"
  ON public.stripe_events 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- RLS policies for refunds (read access for buyers/sellers, write for service role)
CREATE POLICY "Buyers can view their purchase refunds"
  ON public.refunds 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases 
      WHERE purchases.id = refunds.purchase_id 
      AND purchases.buyer_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can view their sale refunds"
  ON public.refunds 
  FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.purchases 
      WHERE purchases.id = refunds.purchase_id 
      AND purchases.seller_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage refunds"
  ON public.refunds 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- Update existing purchases to have paid status if they have amount
UPDATE public.purchases 
SET status = 'paid', amount_total = price, currency = 'usd'
WHERE amount_total = 0 OR amount_total IS NULL;
