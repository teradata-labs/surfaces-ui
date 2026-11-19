"""Builds the sample lake in fixtures/lake: a Parquet file, a Delta table and
an Iceberg table, each with three commits so time travel can be tested.

    uv run --with deltalake --with 'pyiceberg[sql-sqlite,pyarrow]' python scripts/make-fixtures.py

The output is committed, so tests need neither Python nor a network.
"""
import os, shutil, datetime as dt
import pyarrow as pa, pyarrow.parquet as pq
from deltalake import write_deltalake
from pyiceberg.catalog.sql import SqlCatalog

root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "fixtures", "lake"))
shutil.rmtree(root, ignore_errors=True)
os.makedirs(root)

REGIONS = ["North America", "Europe", "Asia Pacific", "Latin America"]
STATUS = ["shipped", "pending", "returned", None]

def orders(start, n):
    ids = list(range(start, start + n))
    return pa.table({
        "order_id": pa.array(ids, pa.int64()),
        "customer": pa.array([f"cust_{i % 37:03d}" for i in ids]),
        "region": pa.array([REGIONS[i % 4] for i in ids]),
        "status": pa.array([STATUS[i % 4] for i in ids]),
        "amount": pa.array([round(((i * 7919) % 100000) / 100, 2) for i in ids], pa.float64()),
        "quantity": pa.array([(i % 9) + 1 for i in ids], pa.int32()),
        "ordered_at": pa.array([dt.datetime(2026, 1, 1) + dt.timedelta(hours=i) for i in ids], pa.timestamp("us")),
    })

pq.write_table(orders(1, 5000), f"{root}/orders.parquet")

d = f"{root}/delta_orders"
write_deltalake(d, orders(1, 1000))
write_deltalake(d, orders(1001, 500), mode="append")
write_deltalake(d, orders(1501, 250), mode="append")

cat = SqlCatalog("local", uri=f"sqlite:///{root}/_catalog.db", warehouse=f"file://{root}")
cat.create_namespace("lake")
t = cat.create_table("lake.iceberg_orders", schema=orders(1, 1).schema, location=f"file://{root}/iceberg_orders")
for start, n in [(1, 1000), (1001, 500), (1501, 250)]:
    t.append(orders(start, n))
os.remove(f"{root}/_catalog.db")
print("wrote", root)
