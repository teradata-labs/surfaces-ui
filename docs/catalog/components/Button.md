# Button

A control that sends an event back to the agent or opens a link. Its label is a child Text.

## Props

- `child`: string — ID of a child component.
- `variant` (optional): "default" | "primary" | "borderless"
- `action`: value or binding
- `minHeight` (optional): integer — The least height of this component's box, in pixels. It is as tall as what it holds, or this, whichever is more.

## Events

Sent through the component's `action`; the event name is the one in the action.

- **press**: When pressed. Carries only the context declared in the action.

## Example

The same component written three ways. Each draws the same surface.

As JSX, with `analyticsMarkup` from `@surfaces-ui/spec/react`:

```tsx
<Ui.Button
  variant="primary"
  action={{ event: { name: "refresh", context: { region: { "@path": "/region" } } } }}
>
  {/* refresh-label is not in the surface */}
</Ui.Button>
```

As an agent sends it (one component of an A2UI `updateComponents` message):

```json
{
  "id": "refresh",
  "component": "Button",
  "child": "refresh-label",
  "variant": "primary",
  "action": {
    "event": {
      "name": "refresh",
      "context": {
        "region": {
          "@path": "/region"
        }
      }
    }
  }
}
```

As a json-render spec, which `fromJsonRender` converts:

```json
{
  "root": "refresh",
  "elements": {
    "refresh": {
      "type": "Button",
      "props": {
        "variant": "primary",
        "action": {
          "event": {
            "name": "refresh",
            "context": {
              "region": {
                "$state": "/region"
              }
            }
          }
        }
      },
      "children": [
        "refresh-label"
      ]
    }
  }
}
```
