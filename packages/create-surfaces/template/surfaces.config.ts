import Anthropic from "@anthropic-ai/sdk";
import { anthropicAgent } from "@surfaces-ui/agent-anthropic";
import { analyticsCatalog, catalogPrompt } from "@surfaces-ui/spec";

/**
 * The data server for this app. `seeds: true` serves six synthetic datasets
 * (retail, healthcare, fraud, telco, transportation, manufacturing). Add your
 * own sources here; credentials are named, never written in this file.
 *
 * The chat's agent runs here, on the server, so the model key never reaches
 * the browser. With ANTHROPIC_API_KEY set it is Claude; without it the chat
 * says that no agent is set up.
 */
export default {
  seeds: true,
  agent: process.env.ANTHROPIC_API_KEY
    ? anthropicAgent({
        client: new Anthropic(),
        system: [
          catalogPrompt(analyticsCatalog),
          "",
          "Data you can query: source `retail` has orders, order_items, customers, products, stores, inventory and returns.",
          "Revenue is order_items.line_amount; join to orders on order_id for dates (ordered_at) and channel.",
        ].join("\n"),
        checkSurface: (message) => analyticsCatalog.validateMessage(message),
      })
    : undefined,
};
