import type { Discovery } from "@surfaces-ui/data";
import type { DataObject } from "@surfaces-ui/proto";
import { type FormEvent, type ReactNode, useRef, useState } from "react";
import { messageOf } from "../data/useRowWindow.js";
import { useDiscovery } from "./shared.js";

export interface AskDataProps {
  /** Called when a cited table is chosen. */
  onOpen?(object: DataObject): void;
  /** Controls beside each cited table, e.g. "Add to context". */
  renderActions?(object: DataObject): ReactNode;
  /** Called when the person chooses to use SQL the answer proposed. Nothing runs on its own. */
  onUseSql?(sql: string): void;
  /** Limit answers to the tables in this saved context pack. */
  contextPackId?: string;
  sourceIds?: string[];
  discovery?: Discovery;
  className?: string;
}

interface Answer {
  question: string;
  text: string;
  citations: { object: DataObject; reason: string }[];
  by?: string;
  sql?: string;
  error?: string;
  streaming: boolean;
}

/**
 * Asks a question about the data in plain language. The answer streams in,
 * names the tables it used, and says which model wrote it. Proposed SQL is
 * shown, never run automatically.
 */
export function AskData(props: AskDataProps) {
  const discovery = useDiscovery(props.discovery);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | undefined>();
  const controller = useRef<AbortController | undefined>(undefined);

  const ask = async (event: FormEvent) => {
    event.preventDefault();
    const asked = question.trim();
    if (asked === "") return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    let next: Answer = { question: asked, text: "", citations: [], streaming: true };
    setAnswer(next);
    const push = (patch: Partial<Answer>) => {
      next = { ...next, ...patch };
      if (!abort.signal.aborted) setAnswer(next);
    };
    try {
      for await (const message of discovery.ask({ question: asked, contextPackId: props.contextPackId, sourceIds: props.sourceIds }, { signal: abort.signal })) {
        const part = message.part;
        if (part.case === "textDelta") push({ text: next.text + part.value });
        else if (part.case === "citation" && part.value.object) push({ citations: [...next.citations, { object: part.value.object, reason: part.value.reason }] });
        else if (part.case === "done") push({ by: part.value.generatedBy, sql: part.value.suggestedSql });
      }
      push({ streaming: false });
    } catch (error) {
      push({ streaming: false, error: messageOf(error) });
    }
  };

  return (
    <div className={["sf-ask", props.className].filter(Boolean).join(" ")}>
      <form className="sf-ask-form" onSubmit={ask}>
        <input
          className="sf-input sf-ask-input"
          aria-label="Ask a question about the data"
          placeholder="Ask about the data, e.g. which table has revenue by region?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button type="submit" className="sf-button" data-variant="primary" disabled={question.trim() === "" || answer?.streaming}>
          Ask
        </button>
      </form>

      {answer && (
        <div className="sf-ask-answer" aria-live="polite" aria-busy={answer.streaming}>
          <p className="sf-ask-question">{answer.question}</p>
          {answer.error ? (
            <p className="sf-search-error" role="alert">
              {answer.error}
            </p>
          ) : (
            <p className="sf-ask-text">{answer.text || (answer.streaming ? "Thinking…" : "")}</p>
          )}
          {answer.citations.length > 0 && (
            <ul className="sf-ask-citations" aria-label="Tables used">
              {answer.citations.map((citation) => (
                <li key={citation.object.name}>
                  <button type="button" className="sf-button" title={citation.reason} onClick={() => props.onOpen?.(citation.object)}>
                    {citation.object.name}
                  </button>
                  {props.renderActions?.(citation.object)}
                </li>
              ))}
            </ul>
          )}
          {answer.sql && (
            <div className="sf-ask-sql">
              <pre tabIndex={0}>{answer.sql}</pre>
              {props.onUseSql && (
                <button type="button" className="sf-button" onClick={() => props.onUseSql?.(answer.sql!)}>
                  Use this SQL
                </button>
              )}
            </div>
          )}
          {answer.by && (
            <p className="sf-ask-by" data-placeholder={answer.by === "placeholder" || undefined}>
              {answer.by === "placeholder" ? "Search results only — no language model is connected." : `Answered by ${answer.by}. Check it against the data.`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
