#!/bin/sh
# Starts a local stand-in for S3 (the adobe/s3mock container) and uploads the
# retail sample to it, so tables, joins and the file browser can be tried
# over object storage without an account anywhere.
#
#   scripts/s3-sim.sh            start it and upload
#   scripts/s3-sim.sh stop       remove it
#
# Then:
#   SURFACES_S3_ENDPOINT=127.0.0.1:9100 pnpm serve              adds the source "s3" to the dev server
#   SURFACES_TEST_S3=127.0.0.1:9100 pnpm --filter @surfaces-ui/dev-server test    runs packages/dev-server/src/s3.test.ts
#
# The mock takes any credentials or none; nothing here is a secret.
set -eu
NAME=surfaces-s3-test
PORT="${SURFACES_S3_PORT:-9100}"
BUCKET="${SURFACES_S3_BUCKET:-acme-lake}"
cd "$(dirname "$0")/.."

docker rm -f "$NAME" >/dev/null 2>&1 || true
[ "${1:-}" = "stop" ] && { echo "Stopped $NAME."; exit 0; }

docker run -d --name "$NAME" -p "127.0.0.1:$PORT:9090" -e "COM_ADOBE_TESTING_S3MOCK_STORE_INITIAL_BUCKETS=$BUCKET" adobe/s3mock:latest >/dev/null
for _ in $(seq 1 30); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/$BUCKET")" = "200" ] && break
  sleep 1
done

put() { curl -sf -o /dev/null -X PUT --data-binary "@packages/seeds/data/retail/$1" "http://127.0.0.1:$PORT/$BUCKET/$2"; echo "  $2"; }
echo "Uploaded to s3://$BUCKET on 127.0.0.1:$PORT:"
put orders.parquet sales/retail/orders.parquet
put order_items.parquet sales/retail/order_items.parquet
put stores.parquet sales/retail/stores.parquet
put products.parquet sales/retail/reference/products.parquet
# Outside the connection's scope (sales/): the source must not be able to list or read it.
put customers.parquet private/customers.parquet
