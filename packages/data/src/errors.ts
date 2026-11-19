/** Where and why a query failed. Mirrors `QueryErrorDetail` in the contract. */
export interface QueryErrorInfo {
  message: string;
  /** Stable code such as SYNTAX, UNKNOWN_COLUMN or NOT_READ_ONLY; empty when unknown. */
  code: string;
  /** 1-based position in the SQL the person wrote; 0 when unknown. */
  line: number;
  column: number;
  /** The engine's own error number, such as Teradata's 3807; absent or empty when the engine gives none. */
  engineCode?: string;
}

/**
 * The error a DataSource throws when a query fails, so an editor can mark the
 * place. Backends that cannot say where simply throw any Error.
 */
export class QueryError extends Error implements QueryErrorInfo {
  readonly code: string;
  readonly line: number;
  readonly column: number;
  readonly engineCode: string;
  constructor(message: string, detail: Partial<Omit<QueryErrorInfo, "message">> = {}) {
    super(message);
    this.name = "QueryError";
    this.code = detail.code ?? "";
    this.line = detail.line ?? 0;
    this.column = detail.column ?? 0;
    this.engineCode = detail.engineCode ?? "";
  }
}

/** Reads what is known about any thrown value, dropping transport prefixes like "[invalid_argument]". */
export function queryErrorInfo(error: unknown): QueryErrorInfo {
  const message = (error instanceof Error ? error.message : String(error)).replace(/^\[[a-z_]+\]\s*/i, "");
  if (error instanceof QueryError) return { message, code: error.code, line: error.line, column: error.column, ...(error.engineCode ? { engineCode: error.engineCode } : {}) };
  return { message, code: "", line: 0, column: 0 };
}
