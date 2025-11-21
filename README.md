# PromptSwap - Deployment & Setup Guide

This repo is a Next.js (App Router) app with Supabase + Stripe integration for selling, swapping, and moderating prompts.

## Prerequisites
- Node.js 18+
- Supabase project (free tier is fine)
- Stripe account (with Connect enabled for payouts)
- Vercel account (for hosting)

## Environment variables (set in `.env.local` and Vercel)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (Settings -> API)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon/public key (Settings -> API)
- `NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY` - Service role key (server-side only, **never expose to client**)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Stripe publishable key (Dashboard -> Developers -> API keys)
- `STRIPE_SECRET_KEY` - Stripe secret key (server only)
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret (Dashboard -> Developers -> Webhooks)
- `NEXT_PUBLIC_SITE_URL` - Your site URL (e.g., https://yourdomain.com)

## Supabase setup
1) Create a project in Supabase.  
2) Copy the project URL and anon key into `.env.local`.  
3) Copy the service role key into `.env.local` (server-side only).  
4) Create a storage bucket named `prompt-images` (optional: make it public if you want public URLs).  
5) Run the SQL schema at `supabase/schema.sql` (via Supabase SQL editor or `psql`). This creates tables for prompts, versions, ratings, sales, swaps, and test runs.  
6) Add `profiles` table fields (if not present): `is_admin boolean default false`, `is_banned boolean default false`, `stripe_account_id text`.  
7) Add `prompt_comments` table if missing: `id uuid default uuid_generate_v4() primary key`, `prompt_id uuid references prompts(id)`, `user_id uuid references auth.users(id)`, `comment text`, `created_at timestamp default now()`.

## Stripe setup
1) Get publishable + secret keys; add to env.  
2) Enable Connect (standard accounts) for creator payouts; store connected account IDs in `profiles.stripe_account_id`.  
3) Set webhook endpoint to `/api/stripe/webhook` and add its signing secret to `STRIPE_WEBHOOK_SECRET`.  
4) Configure Connect return/refresh URLs to `/dashboard/connect-stripe`.

## Local development
```bash
cd promptswap
npm install
npm run dev
```
Populate `.env.local` with the variables above. Uploads are saved to `prompt-images`, and new prompts default to `is_public = false` until approved by an admin.

## Vercel deployment
- Push this repo to GitHub/GitLab.  
- Import into Vercel and set all env vars under Project Settings -> Environment Variables.  
- Optional: keep `vercel.json` (included) to ensure API routes like Stripe webhooks are treated as Node functions.  
- Set `NEXT_PUBLIC_SITE_URL` to your Vercel domain or custom domain.

## GitHub Actions (optional)
`.github/workflows/deploy.yml` runs lint/build and can deploy to Vercel if you set secrets:
- `VERCEL_TOKEN` - Vercel token
- `VERCEL_ORG_ID` - Vercel org ID
- `VERCEL_PROJECT_ID` - Vercel project ID

## Troubleshooting
- 500s on auth-protected routes: ensure you pass the Supabase access token as `Authorization: Bearer <token>` from the client.  
- Stripe webhook failing: verify `STRIPE_WEBHOOK_SECRET` matches the endpoint secret and the route is not behind auth.  
- Missing columns (admin, bans, comments, average_rating): add them via Supabase SQL as noted above.  
- Uploads failing: ensure `prompt-images` bucket exists and is public or use signed URLs.  
- Prompts not visible after upload: admins must approve (they're saved with `is_public=false`).
