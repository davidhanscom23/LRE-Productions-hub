#!/usr/bin/env bash
# Write Stripe keys to .env.local and create the Book Now webhook.
#
#   export STRIPE_SECRET_KEY=sk_test_...          # or sk_live_...
#   export NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
#   export SITE_URL=https://hub.lreproductions.com   # optional
#   ./scripts/setup-stripe-book-now.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

SK="${STRIPE_SECRET_KEY:-}"
PK="${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:-}"
SITE="${SITE_URL:-https://hub.lreproductions.com}"
SITE="${SITE%/}"
WEBHOOK_URL="${SITE}/api/webhooks/stripe"

if [[ -z "$SK" || -z "$PK" ]]; then
  echo "Set STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY, then re-run." >&2
  exit 1
fi
if [[ ! "$SK" =~ ^sk_ ]]; then
  echo "STRIPE_SECRET_KEY should start with sk_" >&2
  exit 1
fi
if [[ ! "$PK" =~ ^pk_ ]]; then
  echo "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY should start with pk_" >&2
  exit 1
fi

echo "Creating Stripe webhook at ${WEBHOOK_URL} ..."
RESP="$(curl -sS https://api.stripe.com/v1/webhook_endpoints \
  -u "${SK}:" \
  -d "url=${WEBHOOK_URL}" \
  -d "enabled_events[]=checkout.session.completed" \
  -d "enabled_events[]=checkout.session.async_payment_succeeded" \
  -d "enabled_events[]=checkout.session.expired" \
  -d "description=LRE Venue Quotes Book Now deposit")"

python3 - "$RESP" "$ROOT/.env.local" "$SK" "$PK" <<'PY'
import json, sys
from pathlib import Path

resp_raw, env_path, sk, pk = sys.argv[1:5]
data = json.loads(resp_raw)
if data.get("error"):
    print("Stripe error:", data["error"], file=sys.stderr)
    sys.exit(1)
whsec = data.get("secret") or ""
whid = data.get("id") or ""
if not whsec:
    print("No webhook secret in response:", data, file=sys.stderr)
    sys.exit(1)

path = Path(env_path)
text = path.read_text() if path.exists() else ""
pairs = {
    "STRIPE_SECRET_KEY": sk,
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": pk,
    "STRIPE_WEBHOOK_SECRET": whsec,
}
lines = text.splitlines()
seen = set()
out = []
for line in lines:
    if not line or line.lstrip().startswith("#") or "=" not in line:
        out.append(line)
        continue
    k = line.split("=", 1)[0].strip()
    if k in pairs:
        out.append(f"{k}={pairs[k]}")
        seen.add(k)
    else:
        out.append(line)
for k, v in pairs.items():
    if k not in seen:
        out.append(f"{k}={v}")
path.write_text("\n".join(out).rstrip() + "\n")
print(f"Updated {path}")
print(f"Webhook id: {whid}")
print("STRIPE_WEBHOOK_SECRET saved (not printed).")
print()
print("Still needed in Vercel → Project → Settings → Environment Variables")
print("(Production + Preview), then Redeploy:")
print("  STRIPE_SECRET_KEY")
print("  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")
print("  STRIPE_WEBHOOK_SECRET  (same value written to .env.local)")
PY
