# A form that writes back

A page with a `Form` whose submissions the dev server checks and stores, then serves back as a read-only table. The server owns the form: its fields, their rules and where submissions go. The browser sends a form id and values, never SQL, a table or a path.

How it works:

- `forms` in the server config defines each form. The server checks every value against its field and stores nothing if any value is wrong. Each error comes back with the field it belongs to.
- Submissions are appended to `<storeDir>/forms/<form id>.jsonl`, one line each, with the server's submission id and the time.
- A DuckDB source reads that file as a table. Its queries go through the same read-only checks as any other source, so the data can be filtered, charted and exported, but not changed.

The server config:

{{file: config.ts}}

`surfaces-dev` loads it from `surfaces.config.ts`:

{{file: surfaces.config.ts}}

The page is a `PageDocument`. Its `Form` names the server's form by id and repeats the fields, so the browser can point out mistakes before anything is sent. The server checks them again either way:

{{file: page.ts}}

In the browser, `FormsProvider` gives every `Form` beneath it somewhere to send. `connectForms` reaches the dev server's `FormService`:

{{file: StoreVisit.tsx}}

```tsx
<StoreVisit server={{ baseUrl: "http://localhost:5220" }} onAction={sendToAgent} />
```

After the server stores a visit, the `visit_logged` event carries the values as stored and the server's submission id. Before that, nothing was saved. To read the visits back, query the `forms` source. Each row holds `id`, `formId`, `submittedAt` and the submitted `values`:

```sql
SELECT values.store AS store, CAST(values.visited_on AS DATE) AS visited_on, values.rating AS rating
FROM store_visits
ORDER BY submittedAt DESC
```

The tests start the dev server in-process on a free port, with a temporary store folder. The first test submits over Connect, then reads the rows back through `connectDataSource`. It also checks that bad values, unknown forms and SQL hidden in the values are all refused:

{{file: writeback.test.ts}}

The second draws the page in jsdom against the same server. It fills the form in and checks the event:

{{file: store-visit.test.tsx}}

Things to know:

- The table is a view over the file, so the file must exist when the server starts. The config creates it empty. Its columns are worked out from what has been submitted, so a query that names a field fails until a submission has a value for it.
- A submission does not clear kept results, so a kept query over this table would miss later submissions. The config sets `storedResults: false`. With other sources on the same server, turn kept results off only where you need to, or pass a fresh `notBefore` when reading.
- The page repeats the server's fields. Keep the two the same: the test compares them. A required field that is missing from the page cannot be filled in, and the server refuses every submission.
- A hand-made request with fields that `SubmitRequest` does not have, such as `table` or `sql`, is not rejected. Those fields are dropped, and only the declared ones reach the form.
- Submissions are kept in a file on the server's disk. This has not been run with more than one server process writing to the same folder, and no form has written to a database table.
