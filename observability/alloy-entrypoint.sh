#!/bin/sh
set -eu
if [ -f /geoip/GeoLite2-City.mmdb ] && [ -s /geoip/GeoLite2-City.mmdb ]; then
  exec /bin/alloy run /etc/alloy/config.alloy --storage.path=/var/lib/alloy/data --server.http.listen-addr=0.0.0.0:12345
fi
exec /bin/alloy run /etc/alloy/config-nogeo.alloy --storage.path=/var/lib/alloy/data --server.http.listen-addr=0.0.0.0:12345
