## Agent ship discipline

Repo-wide Cursor agent habits live in `.cursor/rules/ship-discipline.mdc` (always apply): verify with evidence, three-strike debugging, reproduce-before-fix, plan gap checks, clean dig artifacts, ask for missing keys early.


<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Changelog / What's New (required for EVERY user-facing change)

Whenever you ship a change users can see or feel — a new feature, a UI change, a fix for something that was broken, or a removal — you MUST add an entry to `src/lib/changelog.ts` (`CHANGELOG`, newest first) **in the same commit**:

1. Write for staff, not developers: plain English, one or two sentences on what changed.
2. Set `category` (`new` | `improved` | `fixed` | `removed`), `area` (module name), and the deploy `date` (YYYY-MM-DD).
3. Add `howTo` when using the change isn't obvious.
4. Skip entries only for purely internal changes (refactors, deps, CI) that users cannot perceive.

The `/changelog` page ("What's New" in the sidebar) renders this file directly, and the sidebar NEW badge keys off `CHANGELOG_STAMP` — no other wiring is needed.

## How-to videos (required for every staff-facing change)

Each staff-facing module has a short how-to video (registry: `src/lib/how-to/videos.ts`). Whenever you ship a staff-facing change (new module, changed steps, moved buttons):

1. Record or update the module's video, or — if no HeyGen browser is available — add an entry to `PENDING_HOW_TO_VIDEOS` in `src/lib/how-to/pending.ts` and tell David "video owed: <route>". When he says "make the pending videos", build them.
2. Keep the script in sync with the module's Ask the Hub guide (`src/lib/kb/hub-feature-articles.ts`).
3. After any registry change run `python3 scripts/gen-howto-course.py` and paste the SQL it writes (`supabase/migrations/169_howto_video_course.sql`) inline in your reply — never just the file name.
4. Admin-only modules get a video too, with `audience: "admin"` (shown to admins only). Pages limited to a department or role (for example Vident AV) must set `audience` so the link and the course lesson only show to people who can open the page.
5. Keep this separate from every other hub: the LRE repo, Supabase project and Vercel project only.

## Tools page (required for every new Hub module)

Whenever you add a **user-facing Hub module** staff should open from the app:

1. Add it to `NAV_GROUPS` in `src/components/layout/sidebar.tsx` with the right access flag.
2. Set **`toolsCategory`** on that nav item (`me` | `events` | `vident-av` | `quotes` | `staffing` | `people` | `learn` | `marketing` | `comms` | `admin`). The Tools page groups by this field automatically — do not maintain a separate Tools href list.
3. Add a one-line description in `EXTRA_DESCRIPTIONS` (`src/lib/tools/catalog.ts`) unless a home shortcut already covers it.
4. Add a top-search entry in `src/lib/search/nav-targets.ts` when discovery matters.
5. Add the module's href to `TOOL_ADDED_ON` in `src/lib/tools/catalog.ts` with today's date so its Tools tile shows a NEW tag for anyone who has not visited the Hub since then (it clears per device once opened).
6. Confirm with `npx vitest run src/lib/tools/catalog.test.ts` (fails if any non-Home nav item is missing a known category).

Full always-apply rule: `.cursor/rules/tools-page-registration.mdc`.

## Ask the Hub knowledge base (required for new features)

Whenever you add or meaningfully change a **user-facing Hub capability** (new module, nav item, field tool, or access rule users need to know):

1. **Add or update** an entry in `src/lib/kb/hub-feature-articles.ts` (`HUB_FEATURE_ARTICLES`).
2. Use a **stable `slug`**, clear title, and practical body: what it is, who can use it, main tasks, gotchas.
3. Add 1–2 staff-facing prompts to `src/lib/kb/example-questions.ts` when the feature needs a discoverable “try asking…” example.
4. Do **not** put hub how-tos only in chat replies or PR text — the registry is the source of truth that syncs into Ask the Hub on **Rebuild index**.
5. After deploy/preview, an admin should click **Rebuild index** on `/ask` so embeddings include the new guide.

Custom policy/Q&A articles are still managed in the Ask the Hub admin UI (add / edit / delete). Hub feature guides are code-owned (`source_type: hub_guide`) and refresh automatically on rebuild.

## Event media storage (egress rules)

Supabase egress is on a tight free-plan quota. For anything touching the
`event-media` bucket:

- Every image gets a grid thumbnail at `<storage_path>.thumb.jpg`
  (see `src/lib/storage/thumb-path.ts`). Galleries/grids MUST render the
  thumbnail (`thumb_url`), never the full-size original; full size is for
  lightboxes, downloads, and exports only.
- Client uploads go through `normalizeUploadFile` (HEIC convert + resize to
  2560px) and then `uploadGridThumbnail`. Don't add upload paths that skip
  these.
- Upload with `cacheControl: "31536000"` — object paths are immutable.
- Deleting an original must also delete its `.thumb.jpg`
  (`deleteEventMediaObject` already does).

## Cursor Cloud specific instructions

This is a single Next.js 16 (App Router) app backed by **Supabase** (Postgres + Auth + Storage). There is no separate backend; the Next.js dev server is the only app process. Standard scripts live in `package.json` (`dev`, `build`, `start`, `lint`).

### Services & how to start them

The Docker engine and Supabase CLI are preinstalled in the VM snapshot (not by the update script). On a fresh VM you must start services in this order:

1. **Docker daemon** (Supabase runs in Docker; the daemon is not auto-started):
   - `sudo dockerd` (run it in a background/tmux session), then `sudo chmod 666 /var/run/docker.sock` so the `supabase` CLI can reach Docker without sudo.
2. **Local Supabase stack** (Auth + Postgres + Storage): `npx supabase start`. First start applies `supabase/migrations/*.sql` and `supabase/seed.sql`. Use `npx supabase status` to print URLs/keys and `npx supabase db reset` to rebuild the DB from migrations + seed.
3. **Next.js dev server**: `npm run dev` → http://localhost:3000.

### Environment variables

`.env.local` is gitignored and must exist for the app to boot. For local Supabase it uses the deterministic default demo keys:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
```

(This anon key is Supabase's public local-dev demo key, identical on every machine — not a real secret. If `npx supabase status` ever shows a different `anon key`, use that value.)

For **Venue Quotes → Book Now** Stripe deposits, set:

```
STRIPE_SECRET_KEY=sk_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Point the Stripe webhook to `/api/webhooks/stripe` (events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`). Without these keys, Book Now still saves the request but skips Checkout. Add the same vars in Vercel for production/preview. Run migration `150_venue_portal_stripe_deposit.sql`.

For **Inquiry Forms** (admin `/inquiry-forms`, public `/inquire/<slug>` and `/inquire/embed.js`, migration `167_inquiry_forms.sql`) every variable is optional:

```
# Secret for hashing visitor IPs in the spam limits (unset = derived from SUPABASE_SERVICE_ROLE_KEY).
INQUIRY_FORMS_SECRET=generate-a-long-random-string
# Google Maps key for address lookup and driving miles. Only used if the location check is turned on
# (it ships off: the area is a question on the form). Unset = OpenStreetMap, straight-line miles x 1.2.
GOOGLE_MAPS_API_KEY=
# Cloudflare Turnstile bot check on the public forms; used only when BOTH keys are set.
NEXT_PUBLIC_TURNSTILE_SITE_KEY=
TURNSTILE_SECRET_KEY=
```

The sweep cron `/api/cron/inquiry-forms-sweep` (every 5 minutes, `vercel.json`) needs `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`, like the other crons; the public form API uses the service role too. Optional staff alert emails and the visitor confirmation (off by default) go through `RESEND_API_KEY` + `EMAIL_FROM`, with links built from `NEXT_PUBLIC_SITE_URL` (default `https://hub.lreproductions.com`).

### Non-obvious gotchas

- **Table grants require `supabase/seed.sql`.** The CLI applies migrations as the `postgres` role, and this local Postgres image's default privileges only grant `TRUNCATE/REFERENCES/TRIGGER` (not `SELECT/INSERT/UPDATE/DELETE`) to `anon`/`authenticated`/`service_role`. Without the `grant` statements in `supabase/seed.sql`, the app fails with `permission denied for table ...`. RLS policies in the migrations still enforce row access. Do not delete that seed file.
- **Auth is invite-only** (public signup disabled). To get a usable login, create a confirmed user via the admin API using the service_role key from `npx supabase status`, e.g. `POST http://127.0.0.1:54321/auth/v1/admin/users` with `{"email":...,"password":...,"email_confirm":true,"user_metadata":{"full_name":...,"role":"admin"}}`. The `on_auth_user_created` trigger auto-creates the matching `public.profiles` row (role comes from `user_metadata.role`).
- **First Server Action call may error once.** In dev, the very first submit that triggers a Server Action route (e.g. posting to the home feed) can show "An unexpected response was received from the server" while the route compiles; retrying succeeds.
- **Lint scope:** `npm run lint` also scans `supabase/.temp/` (a `supabase start` artifact of minified bundles) and reports many spurious errors. Lint only the app with `npx eslint src` — that currently passes with 0 errors (only warnings, e.g. `no-unused-vars`/`no-img-element`).
- **Migration version prefixes must be unique.** Supabase's CLI tracker (`supabase_migrations.schema_migrations`) keys on the numeric prefix, so two files sharing a prefix (e.g. two `072_*.sql`) make `npx supabase start`/`db reset` abort with `LegacyMigrationApplyError` and tear down the DB. When adding a migration, use the next unused integer prefix. (Non-numeric disambiguation like `072a_` does not work — the CLI only recognizes `^[0-9]+_` and silently skips the rest.)
- **Prod migrations: paste full SQL in chat.** When a change needs a Supabase SQL Editor run in production/preview (new `supabase/migrations/*.sql` or Hub Health “missing” migration), do **not** only name the file. In the same turn, paste the **entire** migration SQL in a fenced `sql` code block so the user can copy-paste it. Do this every time a migration is introduced or still needs applying.
- **Local mailbox:** invite/confirmation emails are captured by Mailpit at http://127.0.0.1:54324 (no real email is sent).

## Change Log Videos (weekly check)

A weekly scheduled check reads `src/lib/changelog.ts` for entries since the last `changelog_video_runs.check_date`, skips admin-only and fix-only items, and drafts video scripts. Full procedure: `docs/changelog-videos/README.md`. When you add a user-facing changelog entry, keep the title and first sentence plain enough to be read aloud. Do not apply any of this to another hub.
