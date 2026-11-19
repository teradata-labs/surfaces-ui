import { type PageDocument, analyticsCatalog } from "@surfaces-ui/spec";

/**
 * The page a person fills in. The Form names the server's form by id and
 * repeats its fields so it can check them before sending; the server checks
 * them again and decides where they are stored. Nothing here names a table
 * or holds SQL that writes.
 */
export const storeVisitPage: PageDocument = {
  id: "store-visit",
  title: "Log a store visit",
  catalogId: analyticsCatalog.id,
  components: [
    { id: "root", component: "Column", children: ["heading", "intro", "form"] },
    { id: "heading", component: "Text", variant: "h2", text: "Log a store visit" },
    { id: "intro", component: "Text", variant: "body", text: "Saved to the forms source, where the team's visit report reads it." },
    {
      id: "form",
      component: "Form",
      formId: "store-visit",
      title: "Store visit",
      fields: [
        { name: "store", label: "Store", type: "choice", options: ["Leeds", "York", "Hull"], required: true },
        { name: "visited_on", label: "Visited on", type: "date", required: true },
        { name: "rating", label: "Rating", type: "integer", min: 1, max: 5, required: true, help: "1 is poor, 5 is excellent." },
        { name: "follow_up", label: "Needs a follow-up visit", type: "boolean" },
        { name: "note", label: "Note", type: "longtext", maxLength: 500 },
      ],
      submitLabel: "Save visit",
      // Tells the agent (or the host) what was stored, with the server's submission id.
      action: { event: { name: "visit_logged" } },
    },
  ],
};
