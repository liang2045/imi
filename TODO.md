# TODO

- [ ] Create the production Supabase project, run `supabase/migrations/001_initial.sql`, and configure Vercel environment variables.
- [ ] Configure real 快递100 credentials in `.env.local` / server environment and verify with a production tracking number.
- [ ] Add 快递100 webhook/subscription verification if automatic background tracking is required.
- [ ] Connect `/api/influencers/followers` to an authorized platform or third-party data provider for real follower refresh; current implementation is a mock adapter.
- [ ] Complete Vercel preview deployment after Vercel CLI/browser authentication is available.
- [ ] Add production email templates and invite workflow for team members.
- [ ] Add a 390px Chrome visual regression capture when viewport emulation is available.
- [ ] Manually verify the Soft Utility Bento visual integration at desktop and mobile viewports after refreshing the local app; the automated in-app browser connection was unavailable during the 2026-07-14 integration.
- [ ] Configure the server-side RunningHub AI gateway with `AI_ENABLED=true`, `AI_PROVIDER=runninghub`, `RUNNINGHUB_API_KEY`, model and DingTalk session; keep the model key server-only.
- [ ] Perform an end-to-end AI review against each Excel table after the shared gateway is configured, including model timeout and malformed-response handling.
- [ ] Verify the new AI 分析中心 / AI 报告 / AI 审计 pages visually in the app browser and confirm report persistence across reloads.
- [ ] Configure the shared AI gateway and DingTalk session before enabling cloud semantic answers; local fallback remains deterministic.
