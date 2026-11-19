-- Sample data for packages/dev-server/src/postgres.test.ts.
--
-- Start a throwaway database and load this (the passwords are yours to choose
-- and stay in your shell, never in the repo):
--
--   docker run -d --name surfaces-pg-test -e POSTGRES_PASSWORD="$ADMIN_PW" -e POSTGRES_DB=shop -p 127.0.0.1:54329:5432 postgres:17-alpine
--   docker exec -i surfaces-pg-test psql -q -U postgres -d shop -v ON_ERROR_STOP=1 -v rpw="$READER_PW" < scripts/seed-postgres.sql
--
-- Then run the test as the read-only role:
--
--   SURFACES_TEST_POSTGRES="host=127.0.0.1 port=54329 dbname=shop user=reader" \
--   SURFACES_TEST_POSTGRES_PASSWORD="$READER_PW" pnpm --filter @surfaces-ui/dev-server test
--
-- For Supabase or another hosted database, load this with its SQL editor
-- (replace :'rpw' with a password you choose) and add sslmode=require to the address.

CREATE SCHEMA sales;

CREATE TABLE sales.regions (region_id int PRIMARY KEY, name text NOT NULL);
INSERT INTO sales.regions VALUES (1, 'North America'), (2, 'Europe'), (3, 'Asia Pacific'), (4, 'Latin America');

CREATE TABLE sales.customers (
  customer_id int PRIMARY KEY,
  full_name text NOT NULL,
  region_id int REFERENCES sales.regions,
  signed_up date,
  tags text[],
  profile jsonb
);
INSERT INTO sales.customers
SELECT g, 'Customer ' || g, 1 + g % 4, date '2024-01-01' + g, ARRAY['tier' || (g % 3)], jsonb_build_object('score', g % 100)
FROM generate_series(1, 500) g;

CREATE TABLE sales.orders (
  order_id bigint PRIMARY KEY,
  customer_id int REFERENCES sales.customers,
  status text,
  amount numeric(12, 2),
  quantity smallint,
  ordered_at timestamptz,
  note text
);
INSERT INTO sales.orders
SELECT g, 1 + g % 500, (ARRAY['shipped', 'pending', 'returned', NULL])[1 + g % 4], round((g * 7919 % 100000) / 100.0, 2), 1 + g % 9,
       timestamptz '2026-01-01 00:00+00' + g * interval '20 minutes', CASE WHEN g % 50 = 0 THEN 'gift; fragile' END
FROM generate_series(1, 20000) g;

CREATE VIEW sales.open_orders AS SELECT * FROM sales.orders WHERE status = 'pending';
COMMENT ON TABLE sales.orders IS 'One row per order';

-- The library only reads, so it signs in as a role that can only read.
CREATE ROLE reader LOGIN PASSWORD :'rpw';
GRANT CONNECT ON DATABASE shop TO reader;
GRANT USAGE ON SCHEMA sales TO reader;
GRANT SELECT ON ALL TABLES IN SCHEMA sales TO reader;
ANALYZE;
