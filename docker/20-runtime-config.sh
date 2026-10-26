#!/bin/sh
# Substitutes the runtime configuration into index.html before nginx starts.
#
# nginx:unprivileged runs every /docker-entrypoint.d/*.sh on boot, which is
# where this belongs: the bundle is immutable and identical in every
# environment, and only this one line differs between them. Leaving the
# placeholder in place is a valid outcome — the client reads that as
# "same origin" and uses the proxy below.
set -eu

INDEX=/usr/share/nginx/html/index.html
ENDPOINT="${GRAPHQL_ENDPOINT:-}"

if [ -n "$ENDPOINT" ] && [ -f "$INDEX" ]; then
  sed -i "s|__GRAPHQL_ENDPOINT__|${ENDPOINT}|g" "$INDEX"
  echo "runtime-config: graphqlEndpoint=${ENDPOINT}"
else
  echo "runtime-config: no GRAPHQL_ENDPOINT set; the page will use its own origin"
fi
