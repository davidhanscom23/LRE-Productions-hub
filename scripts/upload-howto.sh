#!/bin/bash
# Upload how-to videos to the LRE Bunny storage zone.
#   usage: scripts/upload-howto.sh path/to/video.mp4 [more.mp4 ...]
# Reads the storage-zone password from a local file on your Mac (never pasted,
# never committed): ~/.config/vident-bunny/storage-key  (one line, the zone password).
# LRE only: zone "vident-productions", folder "vident-howto", CDN vident-productions.b-cdn.net.
set -euo pipefail
ZONE="vident-productions"
FOLDER="vident-howto"
CDN="https://vident-productions.b-cdn.net"
KEYFILE="${VIDENT_BUNNY_KEYFILE:-$HOME/.config/vident-bunny/storage-key}"
[ -f "$KEYFILE" ] || { echo "Missing key file: $KEYFILE"; exit 1; }
KEY="$(tr -d '[:space:]' < "$KEYFILE")"
[ $# -ge 1 ] || { echo "usage: $0 file.mp4 [...]"; exit 1; }
# Main region host varies per zone; try the default first, then each region.
HOSTS=(storage.bunnycdn.com ny.storage.bunnycdn.com la.storage.bunnycdn.com uk.storage.bunnycdn.com se.storage.bunnycdn.com sg.storage.bunnycdn.com syd.storage.bunnycdn.com jh.storage.bunnycdn.com)
for f in "$@"; do
  name="$(basename "$f")"
  ok=""
  for h in "${HOSTS[@]}"; do
    code=$(curl -s -o /dev/null -w "%{http_code}" -X PUT \
      -H "AccessKey: $KEY" -H "Content-Type: application/octet-stream" \
      --data-binary "@$f" "https://$h/$ZONE/$FOLDER/$name")
    if [ "$code" = "201" ]; then ok="$h"; break; fi
  done
  [ -n "$ok" ] || { echo "FAILED $name (check the key file)"; exit 1; }
  size=$(wc -c < "$f" | tr -d ' ')
  echo "uploaded $name via $ok ($size bytes)"
  echo "  CDN: $CDN/$FOLDER/$name"
  # If this file was overwritten, purge it in Bunny (Purge > URL) - the CDN caches 30 days.
  len=$(curl -sI "$CDN/$FOLDER/$name" | tr -d '\r' | awk 'tolower($1)=="content-length:"{print $2}')
  echo "  CDN content-length: ${len:-n/a} (expect $size)"
done
