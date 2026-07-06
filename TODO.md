# TODO

- [ ] Create the production Supabase project, run `supabase/migrations/001_initial.sql`, and configure Vercel environment variables.
- [ ] Configure real 快递100 credentials in `.env.local` / server environment and verify with a production tracking number.
- [ ] Add 快递100 webhook/subscription verification if automatic background tracking is required.
- [ ] Connect `/api/influencers/followers` to an authorized platform or third-party data provider for real follower refresh; current implementation is a mock adapter.
- [ ] Complete Vercel preview deployment after Vercel CLI/browser authentication is available.
- [ ] Add production email templates and invite workflow for team members.
- [ ] Add a 390px Chrome visual regression capture when viewport emulation is available.
- [ ] Initialize a Git repository or create versioned source snapshots before further large UI/data-sync changes, so local changes can be reviewed and rolled back safely.
