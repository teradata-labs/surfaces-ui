/** Codes match `QueryErrorDetail.code` in the contract. */
export type SqlErrorCode = "SYNTAX" | "NOT_READ_ONLY" | "MULTIPLE_STATEMENTS" | "INVALID_VIEW";

export class SqlError extends Error {
  constructor(
    readonly code: SqlErrorCode,
    message: string,
    /** 1-based position in the base SQL; 0 when unknown. */
    readonly line = 0,
    readonly column = 0,
  ) {
    super(message);
    this.name = "SqlError";
  }
}
