# GameFlex v2 — Real Analytics + Social Network Buildout

This is a very large scope. To ship it safely, I'll deliver it in phases, each independently useful. Nothing below uses seed/mock data — every number comes from live database queries.

---

## Phase 0 — Admin access + remove mocks (this turn)

- Grant `admin` role in `user_roles` to the user with email `gameflex254@gmail.com` (looked up via `auth.users`).
- Audit `src/lib/mock-data.ts` and any admin/analytics component still importing it. Replace remaining mock reads with live Supabase queries or remove the surface if the table isn't ready.
- Confirm `AdminAnalytics.tsx` (built last turn) reads only from `user_analytics`, `payments`, `registrations`, `tournaments`, `profiles`, `matches`, `leaderboard_stats`. No seeded fallbacks.

## Phase 1 — Analytics engine (8 modules, live data)

New route `/admin/analytics` reorganized into tabs. Each tab reads live from existing tables; no new event pipeline required for v1.

1. **User Analytics** — DAU/MAU/WAU, country breakdown, device split, favorite games (from `matches` + `tournaments.game`), last active, total play time (sum `user_analytics.duration_ms`), churn score (days since last event).
2. **Tournament Analytics** — per-tournament: players joined, checked-in, completion rate (completed matches / total), revenue (sum confirmed payments), profit (revenue − prize_pool), avg duration.
3. **Player Performance** — matches, wins, losses, win rate, rank, XP (points), avg placement, earnings — from `leaderboard_stats` + `matches` + `rewards`.
4. **Revenue Analytics** — tournament + marketplace + wallet revenue from `payments.type`, ARPU (revenue / active users), LTV (revenue / user cohort), daily/weekly/monthly trend.
5. **Behaviour Analytics** — event funnel from `user_analytics.event_type`: login → tournament_viewed → tournament_joined → match_completed → purchase.
6. **Growth Analytics** — new users/day, referral conversion (`referrals`), returning users, acquisition source (from `user_analytics.referrer`), country + game growth.
7. **AI Metrics** — computed client-side heuristics from existing data: skill rating (win rate × matches), engagement (sessions × duration), churn probability (days idle), fraud score (payment failures + rapid signups), tournament recommendation (game affinity).
8. **Executive Dashboard** — the "answer instantly" board: users online (last 5 min), live tournaments, fastest-growing game, top-revenue tournaments, top spenders, churn risk list, best acquisition channel, fastest-growing country, today/week/month revenue, retention %.

All tabs support CSV export and date range filter.

**New DB pieces (migration):** none required for Phase 1 — everything is derivable. If gaps show up, I'll add specific columns per-need, not a blanket schema.

## Phase 2 — Instagram-for-gamers social

Delivered in sub-phases so each ships working:

- **2a — Posts + Home Feed**: new `posts` table (media, caption, game, tournament, post_type, visibility), `post_likes`, `post_comments` (nested), `post_saves`. Home page: Following / For You / Trending tabs with AI ranking (recency × engagement × game affinity × follow graph). Storage bucket `post-media` for images/videos.
- **2b — Create Post**: multi-media upload, caption, game/tournament/team tag, hashtags, mentions, poll type, visibility, schedule.
- **2c — Explore + Search**: trending, by-game sections, search across players/teams/tournaments/posts/hashtags.
- **2d — Profile revamp**: banner, level, XP, rank, followers, verified badge, favorite games, earnings, tabs (Posts / Media / Achievements / Matches / Teams / Saved / Liked).
- **2e — Stories** (upgrade existing `user_statuses`): add polls, questions, mentions, tournament-countdown type.
- **2f — Reels**: vertical short-video feed reusing posts with `post_type='reel'`.
- **2g — DMs upgrade**: images, voice notes, files, GIFs, read receipts, typing indicator (already partial in `messages`).
- **2h — Teams**: `teams`, `team_members`, `team_posts`.
- **2i — Live, Creator page, Saved, Trending, Activity** — surfaces over existing data.

## Phase 3 — PWA (install prompt + offline caching)
Per the PWA skill: manifest + icons + `vite-plugin-pwa` with guarded registration wrapper, NetworkFirst for HTML, CacheFirst for hashed assets.

## Phase 4 — Multi-lobby auto-overflow
When a tournament fills, spawn a sibling lobby (`parent_tournament_id`) with same rules; UI groups them.

---

## Proposed execution order for THIS turn

Only Phase 0 + Phase 1 (analytics tabs 1–8 wired to live data + exec dashboard). This is already ~1500 lines of new/edited code. After you confirm it looks right, I'll start Phase 2a (Posts + Home Feed) in the next turn.

## Technical notes

- Admin grant via `supabase--insert` after looking up user id.
- Analytics uses `@tanstack/react-query` with 60s stale time; heavy aggregations done in SQL via `supabase--read_query`-shaped RPCs where possible, otherwise client-side reduce on paginated fetches capped at 10k rows per query.
- No new event tracking added yet — I'll wire `user_analytics` writes for `tournament_viewed`, `tournament_joined`, `purchase_made`, `search`, `friend_added` in Phase 1 as part of the behaviour funnel, since without those writes the funnel is empty.

Confirm and I'll start with Phase 0 + Phase 1.
