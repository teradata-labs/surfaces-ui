/** One account, as the server sends it. */
export interface Account {
  id: string;
  name: string;
  email: string;
  off: boolean;
  owns: number;
}

export type AccountSort = "name" | "email" | "owns";

/** What the page asks for: the search, the filter, the order and the page. The server does all four. */
export interface AccountQuery {
  q: string;
  status: "" | "on" | "off";
  sort: AccountSort;
  desc: boolean;
  offset: number;
  limit: number;
}

/** Whom an action is for: the rows ticked, or everyone the search and filter match. */
export type Target = { ids: string[] } | { match: { q: string; status: AccountQuery["status"] } };

export type BulkAction = "turn-off" | "turn-on";

export interface BulkResult {
  done: number;
  /** Everyone left alone, with the reason, in a sentence. */
  skipped: { name: string; reason: string }[];
}

/** Your server, as the page sees it: two calls. */
export interface AccountsApi {
  list(query: AccountQuery): Promise<{ accounts: Account[]; total: number }>;
  bulk(action: BulkAction, target: Target): Promise<BulkResult>;
}

/**
 * A stand-in for your server, in memory, for the test and the docs. A real one does the same in its database: it
 * searches, filters, sorts and pages, and it applies an action to "everyone who matches" by running the same search
 * again, never by trusting a list the browser built. The rules (no one turns themselves off) are checked here, on the
 * server, for each person.
 */
export function memoryAccounts(accounts: Account[], me: string): AccountsApi & { accounts: Account[] } {
  const matching = (q: string, status: AccountQuery["status"]) => {
    const words = q.trim().toLowerCase();
    return accounts.filter((a) => (!words || `${a.name} ${a.email}`.toLowerCase().includes(words)) && (!status || (status === "off") === a.off));
  };
  return {
    accounts,
    async list({ q, status, sort, desc, offset, limit }) {
      const found = matching(q, status).sort((a, b) => {
        const order = sort === "owns" ? a.owns - b.owns : a[sort].localeCompare(b[sort]);
        return (desc ? -order : order) || a.id.localeCompare(b.id);
      });
      return { accounts: found.slice(offset, offset + limit).map((a) => ({ ...a })), total: found.length };
    },
    async bulk(action, target) {
      const people = "ids" in target ? accounts.filter((a) => target.ids.includes(a.id)) : matching(target.match.q, target.match.status);
      const result: BulkResult = { done: 0, skipped: [] };
      for (const person of people) {
        const off = action === "turn-off";
        if (off && person.id === me) result.skipped.push({ name: person.name, reason: "you cannot turn off your own account" });
        else if (person.off === off) result.skipped.push({ name: person.name, reason: off ? "already turned off" : "already on" });
        else {
          person.off = off;
          result.done++;
        }
      }
      return result;
    },
  };
}
