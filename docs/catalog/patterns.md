# Human-in-the-loop patterns

Moments in data work where an agent stops and a person decides, each with the surface that asks. Generated from `packages/spec/src/patterns.ts`.

## Connect a source

**When:** A person asks for data that is not connected yet, or onboarding reaches the point of adding a connection.

- Say exactly what will be reachable (the path or database) and that access is read-only.
- Refer to a credential by the name of its secret. Never ask for one in chat and never show one.
- Stop on the step the person must do themselves (adding the secret on the server) and mark it `waiting`.
- Test the connection only after the plan is approved, and report what the test found.

```json
[
  {
    "id": "root",
    "component": "Column",
    "children": [
      "flow",
      "plan"
    ]
  },
  {
    "id": "flow",
    "component": "StepFlow",
    "label": "Connect the sales lake",
    "steps": [
      {
        "id": "scope",
        "title": "Agree what to connect",
        "status": "current"
      },
      {
        "id": "secret",
        "title": "Add the credential on the server",
        "detail": "You do this: I never see it.",
        "status": "pending"
      },
      {
        "id": "test",
        "title": "Test the connection",
        "status": "pending"
      },
      {
        "id": "browse",
        "title": "Browse the tables",
        "status": "pending"
      }
    ]
  },
  {
    "id": "plan",
    "component": "PlanReview",
    "title": "Connect s3://acme-lake/sales",
    "summary": "Read-only access to one folder. Nothing outside it can be read.",
    "proposedBy": "Analyst agent",
    "steps": [
      {
        "id": "connection",
        "title": "Add an S3 connection named sales",
        "kind": "Connect",
        "affects": "s3://acme-lake/sales, region eu-west-1",
        "detail": "Uses the secret LAKE. Set LAKE_KEY_ID and LAKE_SECRET on the server.",
        "required": true
      },
      {
        "id": "orders",
        "title": "Register orders (Delta)",
        "kind": "Connect",
        "affects": "s3://acme-lake/sales/orders"
      },
      {
        "id": "customers",
        "title": "Register customers (Parquet)",
        "kind": "Connect",
        "affects": "s3://acme-lake/sales/customers",
        "detail": "Column names suggest personal data. It will get a personal data review before use.",
        "risk": "medium"
      }
    ],
    "action": {
      "event": {
        "name": "connection_decided"
      }
    }
  }
]
```

## Choose between sources

**When:** Two tables or definitions could answer the question and they disagree. Do not pick silently.

- Give at most six options and recommend one, with the reason in its description.
- Prefer certified data and say when an option is not.
- Carry on with the chosen option only; say which one was used in the answer.

```json
[
  {
    "id": "root",
    "component": "Column",
    "children": [
      "card"
    ]
  },
  {
    "id": "card",
    "component": "DecisionCard",
    "title": "Which revenue should I use?",
    "detail": "The two tables differ by 2.1% for March because one includes returns.",
    "options": [
      {
        "id": "ledger",
        "label": "Finance ledger",
        "description": "Certified. Net of returns. Updated nightly.",
        "recommended": true
      },
      {
        "id": "orders",
        "label": "Orders table",
        "description": "Not certified. Gross. Live."
      }
    ],
    "action": {
      "event": {
        "name": "source_chosen"
      }
    }
  }
]
```

## Onboard to a dataset

**When:** A person is new to a source, or asks where to start.

- Show the whole path first so the person knows how long it is.
- Offer the next step as choices; do not run ahead.
- Each later step that changes or shares data uses its own review pattern.

```json
[
  {
    "id": "root",
    "component": "Column",
    "children": [
      "flow",
      "ask",
      "next"
    ]
  },
  {
    "id": "flow",
    "component": "StepFlow",
    "label": "Get started with the sales data",
    "steps": [
      {
        "id": "connect",
        "title": "Connect the source",
        "status": "done"
      },
      {
        "id": "tour",
        "title": "See what is in it",
        "detail": "Tables, how they join, which are certified.",
        "status": "current"
      },
      {
        "id": "quality",
        "title": "Check quality and personal data",
        "status": "pending"
      },
      {
        "id": "first",
        "title": "Build a first view",
        "status": "pending"
      }
    ]
  },
  {
    "id": "ask",
    "component": "Text",
    "text": "What would you like to look at first?",
    "variant": "body"
  },
  {
    "id": "next",
    "component": "Chips",
    "items": [
      "Show the data model",
      "Which tables are certified?",
      "Profile the orders table"
    ],
    "action": {
      "event": {
        "name": "onboarding_next"
      }
    }
  }
]
```

## Review a cleaning plan

**When:** Profiling found problems (blanks, duplicates, mixed formats, outliers) and you propose fixes.

- One step per fix, with how many rows it touches, counted by the database.
- Anything that removes rows or overwrites values is `risk: "high"`, so it starts unticked.
- Prefer fixes that keep the original (a cleaned view or a new column) over ones that replace it.
- Apply only the approved steps, then show the before and after counts.

```json
[
  {
    "id": "root",
    "component": "Column",
    "children": [
      "plan"
    ]
  },
  {
    "id": "plan",
    "component": "PlanReview",
    "title": "Clean the orders table",
    "summary": "Four fixes found by profiling. The original table is left untouched; the result is a view named orders_clean.",
    "proposedBy": "Analyst agent",
    "steps": [
      {
        "id": "trim",
        "title": "Trim spaces around region",
        "kind": "Clean",
        "affects": "412 of 58,000 rows",
        "sql": "SELECT TRIM(region) AS region FROM orders"
      },
      {
        "id": "case",
        "title": "Write status in lower case",
        "kind": "Clean",
        "affects": "1,930 of 58,000 rows",
        "sql": "SELECT LOWER(status) AS status FROM orders"
      },
      {
        "id": "blank",
        "title": "Treat an empty customer as missing",
        "kind": "Clean",
        "affects": "88 of 58,000 rows",
        "risk": "medium",
        "detail": "Counts of customers will drop by the rows that had an empty value."
      },
      {
        "id": "dedupe",
        "title": "Keep one row per order ID",
        "kind": "Clean",
        "affects": "37 rows left out",
        "risk": "high",
        "detail": "Keeps the most recent row for each ID. Check that repeats are errors, not amendments."
      }
    ],
    "action": {
      "event": {
        "name": "cleaning_decided"
      }
    }
  }
]
```

## Review personal data

**When:** Before a table is shared, exported, put in a dashboard for a wider audience, or its values are sent to a model.

- Flag from column names unless the source allows its values to be read; say which in `basis`.
- Propose the cautious treatment. The person may loosen it; you may not.
- List unflagged columns too: a flag can miss a badly named column.
- Use the decision exactly as recorded, and keep it with the dataset.

```json
[
  {
    "id": "root",
    "component": "Column",
    "children": [
      "review"
    ]
  },
  {
    "id": "review",
    "component": "PiiReview",
    "table": "customers",
    "purpose": "Before sharing with the marketing workspace.",
    "columns": [
      {
        "name": "customer_id",
        "type": "BIGINT"
      },
      {
        "name": "full_name",
        "type": "VARCHAR",
        "category": "name",
        "basis": "name"
      },
      {
        "name": "email",
        "type": "VARCHAR",
        "category": "email",
        "basis": "name"
      },
      {
        "name": "birth_date",
        "type": "DATE",
        "category": "date_of_birth",
        "basis": "name"
      },
      {
        "name": "postcode",
        "type": "VARCHAR",
        "category": "address",
        "basis": "name",
        "action": "generalize"
      },
      {
        "name": "segment",
        "type": "VARCHAR"
      }
    ],
    "action": {
      "event": {
        "name": "pii_decided"
      }
    }
  }
]
```

## Review a transformation

**When:** You propose a new dataset in a pipeline, or a change to one: a join, an aggregate table, a reshaped view.

- Read the pipeline first with `describe_pipeline`, and the tables with `describe_table`.
- Call `propose_dataset` with the query, what it reads, its grain (one row per what), its key and its checks, then draw a `DatasetReview` with exactly what it returns. A pipeline runs only definitions a person approved and the server checked; you never save one yourself.
- Give every dataset a key: it is checked unique and never empty after every build, which is what keeps a join from repeating rows. Add a relationships check for each column that must be found in another table.
- Approving saves; it builds nothing. Offer to run the pipeline afterwards with `run_pipeline`, which asks the person again. A full refresh is irreversible.
- After the run, report row counts and every check that failed, with its count.

```json
[
  {
    "id": "root",
    "component": "Column",
    "children": [
      "flow",
      "review"
    ]
  },
  {
    "id": "flow",
    "component": "StepFlow",
    "label": "Revenue by region",
    "steps": [
      {
        "id": "design",
        "title": "Design the dataset",
        "status": "done"
      },
      {
        "id": "review",
        "title": "Your review",
        "detail": "Approve it below to save it in the pipeline.",
        "status": "waiting"
      },
      {
        "id": "build",
        "title": "Build and check",
        "detail": "A separate step, after you approve.",
        "status": "pending"
      }
    ]
  },
  {
    "id": "review",
    "component": "DatasetReview",
    "pipeline": {
      "id": "sales",
      "name": "Sales",
      "sourceId": "lake",
      "datasets": [
        {
          "name": "orders_clean",
          "sql": "SELECT * FROM orders WHERE status IS NOT NULL",
          "grain": "one row per order",
          "primaryKey": [
            "order_id"
          ]
        },
        {
          "name": "daily_revenue",
          "layer": "gold",
          "sql": "SELECT CAST(ordered_at AS DATE) AS day, region, SUM(amount) AS revenue\nFROM orders_clean\nGROUP BY 1, 2",
          "inputs": [
            "orders_clean"
          ],
          "inputsDeclared": true,
          "grain": "one row per day and region",
          "primaryKey": [
            "day",
            "region"
          ],
          "columns": [
            {
              "name": "day",
              "type": "DATE"
            },
            {
              "name": "region",
              "type": "VARCHAR"
            },
            {
              "name": "revenue",
              "type": "DOUBLE",
              "description": "Sum of amount over the day's orders."
            }
          ],
          "checks": [
            {
              "name": "row_count",
              "kind": "CHECK_KIND_ROW_COUNT",
              "minRows": "1",
              "severity": "CHECK_SEVERITY_WARN"
            }
          ]
        }
      ]
    },
    "dataset": "daily_revenue",
    "expectedVersion": 1,
    "proposedBy": "Analyst agent",
    "action": {
      "event": {
        "name": "transformation_decided"
      }
    }
  }
]
```

## Confirm something that cannot be undone

**When:** The next action destroys or replaces data, widens who can see it, or costs real money or time.

- Say what is lost and whether it can be recovered.
- Recommend the safe option and make it the first.
- Never treat silence, or an earlier approval of something else, as a yes.
- When the person chooses the destructive option, pause the turn with an `ApprovalRequest`: `risk` IRREVERSIBLE (they type “confirm”), the SQL or plan in `sql` or `subject`, its `digest` (`withDigest`), an `expires_at`, and `basis` saying what the data was when you asked. Set `approvals_required` to 2 when the data is shared or regulated.
- Before acting, check the answer with `checkApproval` on your backend: the digest must match what you will run, and an expired or edited answer must be handled as such. Run the person's edited version when they edited it.
- Afterwards, show an `ActionReceipt`.

```json
[
  {
    "id": "root",
    "component": "Column",
    "children": [
      "card"
    ]
  },
  {
    "id": "card",
    "component": "DecisionCard",
    "title": "Rebuild orders_clean from scratch?",
    "detail": "A full refresh replaces all 58,000 rows. The previous version cannot be restored from here.",
    "options": [
      {
        "id": "check",
        "label": "Check only",
        "description": "Run the quality rules without changing anything.",
        "recommended": true
      },
      {
        "id": "rebuild",
        "label": "Rebuild",
        "description": "Replace the table now. Takes about two minutes."
      },
      {
        "id": "cancel",
        "label": "Cancel",
        "description": "Leave everything as it is."
      }
    ],
    "action": {
      "event": {
        "name": "refresh_decided"
      }
    }
  }
]
```

## Report what ran

**When:** Right after anything a person approved has run, whether it worked, partly worked or failed.

- Name who approved it, when and why, from the approval answer (`decided_by`, `decided_at`, `reason`), not from memory.
- Show what actually ran, which is the person's edited version if they edited it, and the counts before and after as the engine reported them.
- Offer `undo` only when it is really possible (a previous version, a snapshot, a reversible change), and say until when and what undoing cannot bring back. Otherwise leave it out.
- Treat the `undo` event as a new request: confirm it with an approval before undoing anything.
- A failure gets a receipt too, saying what was left changed.

```json
[
  {
    "id": "root",
    "component": "Column",
    "children": [
      "receipt"
    ]
  },
  {
    "id": "receipt",
    "component": "ActionReceipt",
    "title": "Rebuilt orders_clean",
    "outcome": "done",
    "summary": "Removed 37 repeated order IDs. The revenue dashboard now reads the new table.",
    "ranAt": "2026-11-13T10:04:00Z",
    "ranBy": "sales pipeline",
    "approvedBy": [
      {
        "by": "Ada Ng",
        "at": "2026-11-13T10:01:00Z",
        "reason": "Counts checked against finance"
      },
      {
        "by": "Grace Ho",
        "at": "2026-11-13T10:02:00Z",
        "reason": "Second approval for shared data"
      }
    ],
    "changes": [
      {
        "label": "Rows",
        "before": "58,000",
        "after": "57,963"
      },
      {
        "label": "Revenue, all time",
        "before": "$4.21M",
        "after": "$4.20M"
      }
    ],
    "sql": "SELECT DISTINCT ON (order_id) * FROM orders ORDER BY order_id, updated_at DESC",
    "undo": {
      "label": "Restore the previous version",
      "description": "Restores the table as it was at 10:03. Rows written since then are lost.",
      "until": "2026-11-20T10:04:00Z"
    },
    "action": {
      "event": {
        "name": "undo_requested"
      }
    }
  }
]
```

## Collect a decision in a form

**When:** A person must record something that is kept: a case outcome, a correction, a request, a label for a model. Use a DecisionCard instead when the answer only steers what you do next.

- Use a Form with a formId the backend defines. You never name a table or write SQL for a submission; the backend decides where it is stored.
- Give every field a type and the rules it must meet; mark what is required. The form checks them, and the backend checks them again.
- Show what the person is deciding about beside the form, read from the data, not restated from memory.
- Wait for the submit event. It carries the values as stored and the backend's submission id; until it arrives, nothing was saved.
- Do not ask for anything you already know or a credential of any kind.

```json
[
  {
    "id": "root",
    "component": "Column",
    "children": [
      "context",
      "form"
    ]
  },
  {
    "id": "context",
    "component": "Text",
    "variant": "body",
    "text": "Alert 4410: three card-not-present payments over 900 within ten minutes, from a new device."
  },
  {
    "id": "form",
    "component": "Form",
    "formId": "case-review",
    "title": "Review this alert",
    "fields": [
      {
        "name": "decision",
        "label": "Decision",
        "type": "choice",
        "options": [
          "Fraud",
          "Not fraud",
          "Needs more information"
        ],
        "required": true
      },
      {
        "name": "amount_at_risk",
        "label": "Amount at risk",
        "type": "number",
        "min": 0
      },
      {
        "name": "note",
        "label": "Note",
        "type": "longtext",
        "maxLength": 500,
        "help": "What you checked, for the next reviewer."
      }
    ],
    "submitLabel": "Save decision",
    "action": {
      "event": {
        "name": "case_reviewed"
      }
    }
  }
]
```

## Create a semantic model

**When:** A person wants the same measures in more than one report, asks what a metric means, or builds a report over tables no model covers yet (list_semantic_models finds none that fits).

- Read the tables with describe_table first. Start from the table whose rows the model counts (an order line, an encounter, a trip) and join only tables that add one row of detail to each: its order, product or store. A join that repeats rows double counts every sum.
- Say what one row is in `grain` and name the columns that make it unique in `primaryKey`; the engine checks the key before the model is saved.
- Propose dimensions, measures and metrics in `proposed.add`, each with your name in `by`. A metric is arithmetic over measures only: a rate is a sum over a sum, never an average of rates.
- Send it as a SemanticModelEditor with `create`. The person can change the joins, the grain, the key and every field, and only their save keeps the model. When they ask for more in words, answer by updating `proposed`.

```json
[
  {
    "id": "root",
    "component": "Column",
    "children": [
      "flow",
      "model"
    ]
  },
  {
    "id": "flow",
    "component": "StepFlow",
    "label": "A model of order lines",
    "steps": [
      {
        "id": "tables",
        "title": "Read the tables and how they join",
        "status": "done"
      },
      {
        "id": "review",
        "title": "Your review",
        "detail": "Check the joins, what one row is and the fields, then save.",
        "status": "waiting"
      },
      {
        "id": "use",
        "title": "Build reports on it",
        "status": "pending"
      }
    ]
  },
  {
    "id": "model",
    "component": "SemanticModelEditor",
    "model": "order_lines",
    "create": {
      "label": "Order lines",
      "description": "Each line sold, with its order, product and store, to measure revenue, cost and margin.",
      "sourceId": "retail"
    },
    "proposed": {
      "rows": {
        "grain": "One order line.",
        "primaryKey": [
          "order_id",
          "line_no"
        ],
        "tables": [
          "order_items",
          "orders",
          "products",
          "stores"
        ],
        "joins": [
          {
            "left": "order_items",
            "right": "orders",
            "keys": [
              {
                "leftColumn": "order_id",
                "rightColumn": "order_id"
              }
            ],
            "type": "left"
          },
          {
            "left": "order_items",
            "right": "products",
            "keys": [
              {
                "leftColumn": "product_id",
                "rightColumn": "product_id"
              }
            ],
            "type": "left"
          },
          {
            "left": "orders",
            "right": "stores",
            "keys": [
              {
                "leftColumn": "store_id",
                "rightColumn": "store_id"
              }
            ],
            "type": "left"
          }
        ]
      },
      "add": [
        {
          "id": "ordered",
          "kind": "attribute",
          "label": "Ordered",
          "column": "ordered_at",
          "grain": "month"
        },
        {
          "id": "region",
          "kind": "attribute",
          "label": "Region",
          "column": "region"
        },
        {
          "id": "category",
          "kind": "attribute",
          "label": "Category",
          "column": "category"
        },
        {
          "id": "revenue",
          "kind": "metric",
          "label": "Revenue",
          "column": "line_amount",
          "aggregate": "sum",
          "format": "currency"
        },
        {
          "id": "lines",
          "kind": "metric",
          "label": "Lines",
          "aggregate": "count",
          "format": "compact"
        },
        {
          "id": "revenue_per_line",
          "kind": "derived",
          "label": "Revenue per line",
          "expression": "revenue / lines",
          "format": "currency"
        }
      ]
    },
    "proposedBy": "Analyst agent",
    "action": {
      "event": {
        "name": "model_saved"
      }
    }
  }
]
```

## Change a semantic model

**When:** A person asks for a metric the model lacks, a definition looks wrong, or a report needs a table the model does not join yet.

- Read the model with describe_semantic_model first, and say who defined anything you would replace.
- Send only what changes: fields to add or put in place, names to remove, and `rows` for a new join, grain or key. Every report on the model changes when it is saved, so say which ones in a sentence.
- A new join must add one row of detail to each row; if it could repeat rows, change the grain and the key with it, or do not join it.
- Nothing is kept until the person saves; the `save` event says the version and every change, and the controls say what they left in the draft.

```json
[
  {
    "id": "root",
    "component": "Column",
    "children": [
      "why",
      "model"
    ]
  },
  {
    "id": "why",
    "component": "Text",
    "text": "Margin is used by three reports; this adds it to the model so they all mean the same thing by it, and removes Brand, which no report uses.",
    "variant": "body"
  },
  {
    "id": "model",
    "component": "SemanticModelEditor",
    "model": "sales_lines",
    "proposed": {
      "add": [
        {
          "id": "cost_share",
          "kind": "derived",
          "label": "Cost share",
          "expression": "cost / revenue",
          "format": "percent",
          "description": "Cost as a share of revenue."
        }
      ],
      "remove": [
        "brand"
      ]
    },
    "proposedBy": "Analyst agent",
    "action": {
      "event": {
        "name": "model_saved"
      }
    }
  }
]
```
