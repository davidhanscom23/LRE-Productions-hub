# LRE Productions Hub: setup checklist

Copied from the Vident Hub code with fresh history. No clients, venues, events, staff or Vident data.

1. New private GitHub repo, push this code.
2. New Supabase project in an "LRE Productions" org; run every file in `supabase/migrations/` in order (includes 195, equipment owner).
3. Run `scripts/lre-inventory-export.sql` in the Vident SQL editor, copy the one result cell, run it in the LRE SQL editor.
4. New Vercel project from the repo; domain hub.lreproductions.com.
5. Env vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, NEXT_PUBLIC_SITE_URL, RESEND_API_KEY, EMAIL_FROM. Optional: Stripe, Twilio, Google Drive backup, Zoom.
6. Supabase Auth: Site URL https://hub.lreproductions.com, redirect allow-list, SMTP via Resend.
7. Invite David and Luke as admins; set award exclusion for owners if wanted.

Needs review before use: Staff Handbook and agreement text (carried over from Vident), company address/phone in `src/lib/company.ts`.
