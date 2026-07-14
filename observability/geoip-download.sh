#!/bin/sh
set -eu
mkdir -p /geoip
DB="/geoip/GeoLite2-City.mmdb"
if [ -f "$DB" ] && [ -s "$DB" ]; then
  echo "geoip db already present"
  exit 0
fi
if [ -z "${MAXMIND_LICENSE_KEY:-}" ]; then
  echo "MAXMIND_LICENSE_KEY unset; skipping GeoLite2 download"
  exit 0
fi
TMP="/tmp/geolite.tgz"
URL="https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz"
echo "downloading GeoLite2-City..."
wget -q -O "$TMP" "$URL"
tar -xzf "$TMP" -C /tmp
FOUND="$(find /tmp -name 'GeoLite2-City.mmdb' | head -n 1)"
if [ -z "$FOUND" ]; then
  echo "GeoLite2-City.mmdb not found in archive"
  exit 1
fi
cp "$FOUND" "$DB"
echo "geoip db installed"
