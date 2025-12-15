# Production deployment checklist

## Environment variables

### Supabase
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or `SUPABASE_ANON_KEY`) power the client SDK.
- `NEXT_PRIVATE_SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SERVICE_ROLE_KEY`) unlocks server-only operations such as cron jobs, admin APIs, downloads, and Stripe webhooks.
- `NEXT_PUBLIC_SITE_URL` keeps URL generation consistent in emails, Slack, and Stripe links.
- `SWAP_EXPIRES_DAYS` defaults to `7` but can be overridden if you need a longer expiry window.

### Stripe
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` for client checkout components.
- `NEXT_PUBLIC_STRIPE_CLIENT_ID` for helper links such as `/dashboard/connect-stripe`.
- `STRIPE_SECRET_KEY` everywhere on the server.
- `STRIPE_WEBHOOK_SECRET` for validating `POST /api/stripe/webhook`.

### Resend
- `RESEND_API_KEY` for sending creator emails; leave the service disabled if unset.
- `EMAIL_FROM` can override the default sender (defaults to `PromptSwap <no-reply@example.com>`).

### OpenAI
- `OPENAI_API_KEY` when you want real AI replies in `/chat/[sessionId]`.
- `USE_MOCK_OPENAI=1` is available for staging/testing when the key is missing.

### Other
- `CRON_SECRET` protects the expiry job; schedule `curl -X POST https://<prod-domain>/api/cron/expire-swaps -H "CRON_SECRET: $CRON_SECRET"` from Vercel Cron or GitHub Actions.
- `SWAP_EXPIRES_DAYS` can be left at `7`, but keep clients aware if you change it.

## Stripe webhook and connect setup

- Point production webhook endpoints to `https://<prod-domain>/api/stripe/webhook`.
- Paste the live webhook secret into `STRIPE_WEBHOOK_SECRET`; test it with `stripe listen` or the dashboard to confirm signatures and successful event deliveries.
- The Stripe Connect onboarding flow uses the same `return_url` and `refresh_url`: `https://<prod-domain>/dashboard/connect-stripe`. Make sure both URLs are configured in the Stripe Connect settings so onboarding hangs in the right place.

## Supabase RLS & policy verification

- All schema changes happen inside `supabase/migrations`; Supabase SQL migrations are canonical for this project.
- Review the SQL files (especially the RLS hardening files under `supabase/migrations/20251204*`) before deploying to confirm the policies still match the code expectations for `public` tables such as `prompts`, `profiles`, `swaps`, and `notifications`.
- After migrations run in production, use Supabase Studio to spot-check policy counts and that tables require authenticated users. If you adjust a policy, add the change to a new `supabase/migrations` file and rerun CI before merging.

## Smoke tests

Before tagging a release, exercise these flows manually or via automated scripts:

1. **Auth** – register/sign in, refresh session, sign out, and confirm the cookies match the domain.
2. **Purchase** – buy a prompt in the marketplace, ensure Stripe returns to `success`, and the purchase record is created.
3. **Download** – download a purchased prompt via `/api/prompts/[id]/download` and confirm the prompt text is returned.
4. **Swaps** – create a swap request, accept/decline it, and verify the expected notifications appear for both users.
5. **Refund request** – open a refund request via the admin UI or API and ensure the record status changes to `open`.
6. **Notifications** – confirm the new notification shows up in the UI (e.g., via the bell icon or Supabase `notifications` table) for the above flows.
7. **Creator onboarding** – connect Stripe via `/dashboard/connect-stripe`, complete onboarding, and confirm a Stripe account is stored on the profile.

## Automated smoke suite

`npm run smoke` executes `scripts/smoke.mjs`, which validates that:

1. All required environment variables (the Supabase/Stripe/Resend/OpenAI keys listed above) are present before touching the network.
2. `/api/health` responds with HTTP 200 and exposes an `x-request-id` header.
3. `/api/prompts/search` accepts a lightweight query and returns the expected `{ ok: true, data: { items, page, pageSize, total } }` shape.
4. `/api/notifications` succeeds when `SMOKE_AUTH_TOKEN` (a Supabase `access_token`) is supplied; leave the variable unset to skip this authenticated check.

Override the target `BASE_URL` to point the script at staging/prod (e.g., `BASE_URL=https://staging.example.com npm run smoke`). The script exits with a non-zero code and actionable error on failure.

## CI guardrails and deployment

- `workflows/deploy.yml` now runs `npm ci`, `node scripts/check-migrations-sync.mjs`, `npm run lint`, `npm test`, and `npm run build`. If any of these steps fail, the merge is blocked.
- The guardrail script enforces **Supabase SQL migrations as the source of truth** by failing whenever `prisma/migrations` contains files (other than `.gitkeep`). Keep `prisma/migrations` clean unless you intentionally sync Prisma migrations back to Supabase and update the guardrail rule accordingly.
- Type errors are forced to fail because the CI workflow runs `npm run build`.

- Deployments happen via the same workflow: once the `ci` job passes on `main`, the `deploy` job runs `npm ci` again and then uses `npx vercel pull`, `npx vercel build --prod`, and `npx vercel deploy --prebuilt --prod` to push the site.
