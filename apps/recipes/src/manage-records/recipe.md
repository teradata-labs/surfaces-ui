# Records a person manages

A page of accounts an admin manages: searched, filtered, sorted and paged on your server, changed one at a time from a row or many at once, including everyone a search matches on pages never opened. The same shape fits invitations, jobs, keys or anything else your own server holds. It is built from `DataTable`, `SelectionBar`, `Pagination`, `useConfirm`, `StatusBadge`, `SegmentedControl` and `ActionReceipt`, with no table, dialog or bar of its own.

How it works:

- The page holds the query (search, filter, order, page) and asks your server for one page at a time. `DataTable` sorts nothing: a press on a heading calls `onSortChange`, and the page asks the server again. `Pagination` does the same for Previous and Next. A new search, filter or order goes back to the first page with nothing chosen.
- Ticking boxes chooses rows on this page. Once the page is ticked, `SelectionBar` offers "Select all N that match". The action then goes to the server as the search and filter, not as a list of ids, so it reaches people the browser never loaded, and the server runs the same search again to find them.
- The server applies its own rules to each person (no one turns themselves off) and says whom it left alone and why. `ActionReceipt` shows that, `partial` when some were skipped.
- Turning accounts off is hard to undo, so the page asks first with `useConfirm`, naming the button for the action. Turning them back on does not ask.

Your server, as the page sees it, is two calls. The stand-in here keeps the accounts in memory; yours does the same in its database:

{{file: api.ts}}

The page:

{{file: Accounts.tsx}}

```tsx
<Accounts api={yourAccountsApi} me={signedInUserId} />
```

The test draws the page in jsdom against the stand-in with 120 accounts. It checks that sorting and paging ask the server, that "everyone who matches" reaches the server as a search, and that the receipt names the four people left alone:

{{file: accounts.test.tsx}}

Things to know:

- Check who may act on the server, for every person in the batch, as you would for one. The browser's list of ids is a convenience, not permission, and "everyone who matches" must be bounded on the server (refuse a batch past a limit rather than run it partly).
- The selection belongs to the page. When the rows change under it (another admin turned someone off), "select all that match" acts on the rows that match when the server runs the action, not those shown when it was chosen.
- Keep the row's own actions to the everyday ones. Anything rarer belongs on the record's own page, reached from its name.
