#!/bin/sh
set -eu
mkdir -p /geoip
DB="/geoip/GeoLite2-City.mmdb"
if [ -f "$DB" ] && [ -s "$DB" ]; then
  echo "geoip db already present ($(wc -c < "$DB") bytes)"
  exit 0
fi

download_maxmind() {
  if [ -z "${MAXMIND_LICENSE_KEY:-}" ]; then
    return 1
  fi
  TMP="/tmp/geolite.tgz"
  URL="https://download.maxmind.com/app/geoip_download?edition_id=GeoLite2-City&license_key=${MAXMIND_LICENSE_KEY}&suffix=tar.gz"
  echo "downloading MaxMind GeoLite2-City..."
  wget -q -O "$TMP" "$URL" || return 1
  tar -xzf "$TMP" -C /tmp
  FOUND="$(find /tmp -name 'GeoLite2-City.mmdb' | head -n 1)"
  if [ -z "$FOUND" ]; then
    return 1
  fi
  cp "$FOUND" "$DB"
  echo "geoip db installed from MaxMind"
  return 0
}

download_dbip() {
  year="$(date -u +%Y)"
  month="$(date -u +%m)"
  month=$((10#$month))
  i=0
  while [ "$i" -lt 3 ]; do
    m=$((month - i))
    y="$year"
    while [ "$m" -le 0 ]; do
      m=$((m + 12))
      y=$((y - 1))
    done
    stamp="$(printf '%04d-%02d' "$y" "$m")"
    URL="https://download.db-ip.com/free/dbip-city-lite-${stamp}.mmdb.gz"
    TMP="/tmp/dbip-city.mmdb.gz"
    echo "downloading DB-IP City Lite ${stamp}..."
    if wget -q -O "$TMP" "$URL"; then
      gzip -dc "$TMP" > "$DB"
      if [ -s "$DB" ]; then
        echo "geoip db installed from DB-IP ${stamp}"
        return 0
      fi
    fi
    i=$((i + 1))
  done
  return 1
}

if download_maxmind; then
  exit 0
fi
if download_dbip; then
  exit 0
fi
echo "geoip db unavailable; Alloy will run without geo"
exit 0
