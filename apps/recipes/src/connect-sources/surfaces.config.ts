import { defineConfig } from "@surfaces-ui/dev-server";

/**
 * Three places data lives, as the dev server reads them. No credential is
 * written here: each `secret` is a name, and the server reads the values
 * from its own environment (`PG_PASSWORD`, `LAKE_KEY_ID`, `LAKE_SECRET`,
 * `TD_PASSWORD`). Every source is read-only.
 */
export default defineConfig({
  sources: [
    {
      // A Postgres database (also Supabase, Neon or RDS), attached read-only through DuckDB.
      // Its tables are named shop.<schema>.<table>, e.g. shop.public.orders.
      id: "shop",
      displayName: "Shop database",
      engine: "duckdb",
      tables: [],
      catalogs: [
        {
          name: "shop",
          kind: "postgres",
          // Where to connect and as whom. Never the password: that is PG_PASSWORD.
          uri: "host=db.example.com port=5432 dbname=shop user=surfaces_reader sslmode=require",
          secret: "PG",
        },
      ],
    },
    {
      // A Delta table in S3. Only paths under the connection's scope can be read.
      id: "lake",
      displayName: "Sales lake",
      engine: "duckdb",
      connections: [{ name: "sales", kind: "s3", scope: "s3://acme-lake/sales/", secret: "LAKE", region: "eu-west-1" }],
      tables: [
        {
          name: "orders",
          format: "delta",
          path: "s3://acme-lake/sales/orders",
          comment: "One row per order, written by the checkout service.",
          // Parquet and Delta hold no keys; say what they are here.
          model: { primaryKey: ["order_id"], columns: { amount: "Order total in euros, after discounts." } },
        },
      ],
    },
    {
      // Teradata through Teradata Query Service (its REST API).
      id: "warehouse",
      displayName: "Teradata warehouse",
      engine: "teradata",
      baseUrl: "https://vantage.example.com:1443",
      system: "prod",
      // A user that holds SELECT rights only: Teradata has no read-only session.
      user: "surfaces_reader",
      secret: "TD",
      database: "sales",
    },
  ],
});
