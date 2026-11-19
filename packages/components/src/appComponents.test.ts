import { describe, expect, it } from "vitest";
import { appComponentCode, appComponentMarkdown, componentsAppComponents, describeAppComponent, itemControlsDoc } from "./appComponents.js";
import type { ItemControlsProps } from "./controls/ItemControls.js";

describe("app component descriptions", () => {
  it("cannot name a prop the component does not have", () => {
    const describe = describeAppComponent<ItemControlsProps>();
    describe({
      name: "ItemControls",
      from: "x",
      description: "",
      // @ts-expect-error: ItemControls has no `colour` prop.
      props: { type: "object", properties: { colour: { type: "string" } } },
      parts: [],
      callbacks: [],
      example: {},
    });
    expect(true).toBe(true);
  });

  it("has a unique name, a description and an example that only uses its props", () => {
    const names = componentsAppComponents.map((doc) => doc.name);
    expect(new Set(names).size).toBe(names.length);
    for (const doc of componentsAppComponents) {
      expect(doc.description.length).toBeGreaterThan(40);
      const known = new Set([...Object.keys(doc.props.properties), ...doc.parts.map((p) => p.prop)]);
      for (const key of Object.keys(doc.example)) expect(known.has(key), `${doc.name}.${key}`).toBe(true);
    }
  });

  it("writes a reference page and the JSX for what is switched on", () => {
    const page = appComponentMarkdown(itemControlsDoc);
    expect(page).toContain('import { ItemControls } from "@surfaces-ui/components";');
    expect(page).toContain("| `label` | string | yes |");
    expect(page).toContain("`controls` (required)");
    expect(appComponentCode(itemControlsDoc, { label: "Tile controls", show: "always", quietable: false }, ["controls"])).toBe(
      '<ItemControls label="Tile controls" show="always" controls={controls} />',
    );
  });
});
