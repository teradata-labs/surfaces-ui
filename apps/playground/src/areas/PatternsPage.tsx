import { BulletGraph, Chart, CodeBlock, Markdown, Metric, Sparkline, chartAdvice } from "@surfaces-ui/components";
import { type Pattern, analyticsCatalog, applyMessages, patternMessages, patterns } from "@surfaces-ui/spec";
import { SurfaceView, analyticsRenderers } from "@surfaces-ui/spec/react";
import { useMemo, useState } from "react";
import { focusFor, useThirds } from "../focus.js";
import { type ActiveSource, firstTable } from "../source.js";


/** One pattern drawn live, with what it sends back when a person decides. */
function PatternCard({ pattern }: { pattern: Pattern }) {
  const surface = useMemo(() => applyMessages({}, patternMessages(pattern)).main!, [pattern]);
  const [sent, setSent] = useState<string | undefined>();
  return (
    <section className="card pattern" aria-label={pattern.title}>
      <div className="card-head">
        <h2>{pattern.title}</h2>
      </div>
      <Markdown className="hint" text={pattern.when} />
      <div className="pattern-body">
        <SurfaceView surface={surface} catalog={analyticsCatalog} renderers={analyticsRenderers} onAction={(action) => setSent(JSON.stringify(action, null, 2))} />
        <div className="pattern-side">
          <h3>Rules for the agent</h3>
          <ul>
            {pattern.rules.map((rule) => (
              <li key={rule}>
                <Markdown inline text={rule} />
              </li>
            ))}
          </ul>
          <h3>Sent back to the agent</h3>
          <div aria-live="polite">
            {sent ? <CodeBlock bare code={sent} language="json" label="Sent back to the agent" /> : <p className="hint">Nothing yet. Make a decision in the card.</p>}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Tufte and Few in practice, over the picked data: figures with their trend, a measure against bands, and advice on a poor chart. */
function Figures({ source }: { source: ActiveSource }) {
  const focus = focusFor(source.sourceId, firstTable(source));
  const { measure, trend, breakdown } = focus;
  const average = focus.metrics.find((m) => m.column && m.aggregate !== "count" && m.aggregate !== "count_distinct") ?? measure;
  const thirds = useThirds(source.dataSource, source.sourceId, average.sql, average.column);
  const advice = chartAdvice({ type: "pie", categories: 9 }).concat(chartAdvice({ type: "bar", categories: 4, rightAxis: true }));
  return (
    <section className="card" aria-label="Figures">
      <div className="card-head">
        <h2>Figures, trends and targets</h2>
      </div>
      <p className="hint">
        Over {focus.title}. Small, dense and labelled in words: a sparkline shows direction without axes, and a bullet graph judges a number against bands without a gauge.
      </p>
      <div className="figures sf-container">
        <div className="figures-col">
          {focus.metrics.slice(0, 2).map((m) => (
            <Metric key={m.label} sourceId={source.sourceId} sql={m.sql} column={m.column} aggregate={m.aggregate} label={m.label} format={m.format} />
          ))}
          <Sparkline sourceId={source.sourceId} sql={trend.sql} x={trend.x} grain="month" column={trend.column} aggregate={trend.aggregate} label={trend.label} format={trend.format} />
          <Sparkline sourceId={source.sourceId} sql={trend.sql} x={trend.x} grain="month" aggregate="count" label={`Rows by month`} format="compact" />
        </div>
        <div className="figures-col">
          {average.column && thirds ? (
            <>
              <BulletGraph sourceId={source.sourceId} sql={average.sql} column={average.column} aggregate="avg" label={`Average ${average.column}`} format={average.format} ranges={thirds} />
              <BulletGraph sourceId={source.sourceId} sql={average.sql} column={average.column} aggregate="median" label={`Median ${average.column}`} format={average.format} ranges={thirds} />
              <p className="hint">The bands are the data's own thirds, worked out by the engine; there is no business target here.</p>
            </>
          ) : (
            <p className="hint">{average.column ? "Working out the bands…" : "This dataset's headline is a count, so there is no value to judge against bands."}</p>
          )}
        </div>
        <div className="figures-col">
          <Chart sourceId={source.sourceId} sql={breakdown.sql} type="bar" x={breakdown.x} y={breakdown.y} yTitle={breakdown.yTitle} label={breakdown.label} legend="none" height={180} />
        </div>
      </div>
      <h3>Advice a chart gives before it misleads</h3>
      <ul className="advice">
        {advice.map((a) => (
          <li key={a.rule}>
            {a.message} <span>Instead: {a.instead}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The human-in-the-loop patterns, each drawn from its catalog definition. */
export function PatternsPage({ source }: { source: ActiveSource }) {
  return (
    <div className="patterns">
      <Figures source={source} />
      {patterns.map((pattern) => (
        <PatternCard key={pattern.id} pattern={pattern} />
      ))}
    </div>
  );
}
