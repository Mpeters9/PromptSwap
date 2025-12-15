# RLS policy summary

| Table             | Select                                    | Insert/Update/Delete                       | Notes |
|-------------------|-------------------------------------------|---------------------------------------------|-------|
| profiles          | self, admin, service role                 | self, admin, service role                   | Admin detection via profiles.is_admin |
| prompts           | public or owner; admin/service override   | owner; admin/service override               | Approval/admin handled via admin override |
| prompt_versions   | owner, prompt owner, public prompt, admin/service | owner/admin/service                       | |
| purchases         | buyer, seller, admin/service              | admin/service only                         | Webhook/admin writes only |
| swaps             | requester/responder, admin/service        | requester/responder, admin/service         | |
| prompt_comments   | prompt public/owner, comment owner, admin/service | owner; admin/service moderation           | |
| prompt_ratings    | public prompt, owner, admin/service       | owner; admin/service                       | |
| refund_requests   | requester, admin/service                  | requester insert; admin/service update     | Unique open enforced separately |
| refunds           | buyer/seller of purchase, admin/service   | admin/service only                         | |
| stripe_events     | service role only                         | service role only                          | Webhook idempotency guard |

All relevant tables have RLS enabled and least-privilege policies added in `supabase/migrations/20251215094500_rls_hardening.sql`.
