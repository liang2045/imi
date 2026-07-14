# TODO

- [ ] Create the production Supabase project, run `supabase/migrations/001_initial.sql`, and configure Vercel environment variables.
- [ ] Configure real 快递100 credentials in `.env.local` / server environment and verify with a production tracking number.
- [ ] Add 快递100 webhook/subscription verification if automatic background tracking is required.
- [ ] Connect `/api/influencers/followers` to an authorized platform or third-party data provider for real follower refresh; current implementation is a mock adapter.
- [ ] Complete Vercel preview deployment after Vercel CLI/browser authentication is available.
- [ ] Add production email templates and invite workflow for team members.
- [ ] Add a 390px Chrome visual regression capture when viewport emulation is available.
- [ ] Manually verify the Soft Utility Bento visual integration at desktop and mobile viewports after refreshing the local app; the automated in-app browser connection was unavailable during the 2026-07-14 integration.
