import {
  ActionReceipt,
  type DataTableColumn,
  type DataTableSort,
  DataTable,
  Pagination,
  SegmentedControl,
  SelectionBar,
  StatusBadge,
  useConfirm,
} from "@surfaces-ui/components";
import { useCallback, useEffect, useState } from "react";
import type { Account, AccountQuery, AccountSort, AccountsApi, BulkAction, BulkResult, Target } from "./api.js";

const PAGE = 50;

const COLUMNS: DataTableColumn<Account>[] = [
  { id: "name", label: "Name", sortable: true },
  { id: "email", label: "Email", sortable: true, show: "medium" },
  { id: "status", label: "Status", cell: (a) => <StatusBadge label={a.off ? "Turned off" : "On"} tone={a.off ? "danger" : "success"} /> },
  { id: "owns", label: "Owns", sortable: true, align: "end", show: "wide" },
];

const WORDS: Record<BulkAction, { button: string; done: string }> = {
  "turn-off": { button: "Turn off", done: "Turned off" },
  "turn-on": { button: "Turn back on", done: "Turned back on" },
};

/** Accounts a person manages: searched, filtered, sorted and paged on the server, changed one at a time or many at once. */
export function Accounts({ api, me }: { api: AccountsApi; me: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<AccountQuery["status"]>("");
  const [sort, setSort] = useState<DataTableSort>({ column: "name", desc: false });
  const [offset, setOffset] = useState(0);
  const [page, setPage] = useState<{ accounts: Account[]; total: number }>({ accounts: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [allMatching, setAllMatching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ action: BulkAction; result: BulkResult }>();
  const { confirm, element } = useConfirm();

  const load = useCallback(async () => {
    setLoading(true);
    const query: AccountQuery = { q, status, sort: sort.column as AccountSort, desc: sort.desc, offset, limit: PAGE };
    setPage(await api.list(query));
    setLoading(false);
  }, [api, q, status, sort, offset]);
  useEffect(() => void load(), [load]);

  // A new search, filter or order starts again from the first page with nothing chosen.
  const changeQuery = (change: () => void) => {
    change();
    setOffset(0);
    setSelected(new Set());
    setAllMatching(false);
  };

  const run = async (action: BulkAction, target: Target, count: number) => {
    if (action === "turn-off") {
      const ok = await confirm({
        title: count === 1 ? "Turn off 1 account?" : `Turn off ${count} accounts?`,
        body: "They are signed out everywhere now and cannot sign in until turned back on. What they own stays theirs.",
        confirmLabel: "Turn off",
        danger: true,
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      setReceipt({ action, result: await api.bulk(action, target) });
      setSelected(new Set());
      setAllMatching(false);
    } finally {
      setBusy(false);
      await load();
    }
  };

  const ticked = page.accounts.filter((a) => selected.has(a.id));
  const count = allMatching ? page.total : ticked.length;
  const target = (): Target => (allMatching ? { match: { q, status } } : { ids: ticked.map((a) => a.id) });
  const choosable = page.accounts.filter((a) => a.id !== me);

  return (
    <section aria-label="Accounts" className="accounts">
      <div className="accounts-tools">
        <label>
          Find someone <input className="sf-input" type="search" value={q} onChange={(e) => changeQuery(() => setQ(e.target.value))} />
        </label>
        <SegmentedControl
          label="Show"
          value={status}
          onChange={(next) => changeQuery(() => setStatus(next))}
          options={[
            { value: "", label: "Everyone" },
            { value: "on", label: "On" },
            { value: "off", label: "Turned off" },
          ]}
        />
      </div>

      {receipt && (
        <ActionReceipt
          title={`${WORDS[receipt.action].done} ${receipt.result.done === 1 ? "1 account" : `${receipt.result.done} accounts`}`}
          outcome={receipt.result.skipped.length === 0 ? "done" : receipt.result.done === 0 ? "failed" : "partial"}
          summary={receipt.result.skipped.length ? `Left ${receipt.result.skipped.length} alone.` : undefined}
          changes={receipt.result.skipped.map((s) => ({ label: s.name, after: `Skipped: ${s.reason}` }))}
        />
      )}

      <SelectionBar
        count={count}
        total={page.total}
        pageSelected={choosable.length > 0 && choosable.every((a) => selected.has(a.id))}
        allMatching={allMatching}
        onAllMatchingChange={setAllMatching}
        busy={busy}
        onClear={() => (setSelected(new Set()), setAllMatching(false))}
        actions={(["turn-on", "turn-off"] as const).map((action) => ({
          id: action,
          label: WORDS[action].button,
          danger: action === "turn-off",
          onSelect: () => void run(action, target(), count),
        }))}
      />

      <DataTable
        label="Accounts"
        columns={COLUMNS}
        rows={page.accounts}
        rowKey={(a) => a.id}
        rowName={(a) => a.name}
        rowState={(a) => (a.off ? "off" : undefined)}
        loading={loading}
        empty="No one matches."
        sort={sort}
        onSortChange={(next) => changeQuery(() => setSort(next))}
        selected={selected}
        allSelected={allMatching}
        selectable={(a) => a.id !== me}
        onSelectedChange={(next) => (setAllMatching(false), setSelected(next))}
        rowControls={(a) => [
          a.off
            ? { id: "turn-on", label: `Turn ${a.name} back on`, icon: "power", onSelect: () => void run("turn-on", { ids: [a.id] }, 1) }
            : { id: "turn-off", label: `Turn off ${a.name}`, icon: "power", onSelect: () => void run("turn-off", { ids: [a.id] }, 1), disabled: a.id === me },
        ]}
      />

      <Pagination offset={offset} pageSize={PAGE} total={page.total} busy={loading} onChange={setOffset} />
      {element}
    </section>
  );
}
