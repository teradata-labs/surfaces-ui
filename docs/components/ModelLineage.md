# ModelLineage

`import { ModelLineage } from "@surfaces-ui/components";`

Where a semantic model's rows come from when a pipeline builds them: the dataset, when it was last built, the latest run's checks, whether its key was checked and what it reads. One line over an explorer or a report, or a panel. Display only: it queries nothing.

## Props

| Prop | Type | Required | What it is |
|---|---|---|---|
| `model` | object | yes | A model whose rows are a pipeline's dataset (`dataset`); anything else draws nothing. |
| `compact` | boolean |  | One line, for above an explorer or a report. |

## Parts the host supplies

Props that take code. Each is optional unless marked; the component leaves out what it needs it for.

- `pipelines`: **Pipelines backend.** Where the dataset's definition and runs come from. Without it (or a PipelinesProvider) only the dataset's name is shown.

## Callbacks

- `onUseDataset`: Offered when the model's grain or key differs from the dataset's.
- `onOpenDataset`: Opens the dataset in the host's pipeline view.

## Example

```tsx
<ModelLineage pipelines={pipelines} onUseDataset={…} onOpenDataset={…} />
```
