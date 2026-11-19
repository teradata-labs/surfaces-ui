/** Kinds of personal or sensitive data a column may hold. */
export type PiiCategory =
  | "name"
  | "email"
  | "phone"
  | "address"
  | "government_id"
  | "financial"
  | "date_of_birth"
  | "network"
  | "location"
  | "credential"
  | "health"
  | "demographic";

/** What to do with a column before it is shared, charted or sent to a model. */
export type PiiAction = "keep" | "mask" | "hash" | "generalize" | "drop";

export const PII_LABELS: Record<PiiCategory, string> = {
  name: "Person's name",
  email: "Email address",
  phone: "Phone number",
  address: "Postal address",
  government_id: "Government ID",
  financial: "Card or account number",
  date_of_birth: "Date of birth",
  network: "IP or device ID",
  location: "Precise location",
  credential: "Password or key",
  health: "Health information",
  demographic: "Sensitive personal trait",
};

export const PII_ACTION_LABELS: Record<PiiAction, string> = {
  keep: "Keep as is",
  mask: "Mask (show part)",
  hash: "Hash (keep joins working)",
  generalize: "Generalise (coarser value)",
  drop: "Leave out",
};

/** The cautious default for each kind: a person can loosen it, with their name on the decision. */
export const PII_DEFAULT_ACTION: Record<PiiCategory, PiiAction> = {
  name: "mask",
  email: "hash",
  phone: "mask",
  address: "drop",
  government_id: "drop",
  financial: "drop",
  date_of_birth: "generalize",
  network: "hash",
  location: "generalize",
  credential: "drop",
  health: "drop",
  demographic: "drop",
};

const PATTERNS: [PiiCategory, RegExp][] = [
  ["credential", /(^|_)(password|passwd|pwd|secret|api_?key|token|private_?key)(_|$)/],
  ["government_id", /(^|_)(ssn|social_security|national_id|nin|passport|drivers?_licen[cs]e|tax_id|tin|ein|aadhaar)(_|$)/],
  ["financial", /(^|_)(card_?(number|num|no)|pan|cvv|cvc|iban|swift|routing|account_?(number|num|no)|bank_account)(_|$)/],
  ["email", /(^|_)e?_?mail(_address)?(_|$)/],
  ["phone", /(^|_)(phone|mobile|cell|msisdn|fax|tel)(_?(number|num|no))?(_|$)/],
  ["date_of_birth", /(^|_)(dob|birth_?(date|day)|date_of_birth|birthdate)(_|$)/],
  ["network", /(^|_)(ip|ip_?address|ipv4|ipv6|mac_?address|device_id|imei|idfa|user_agent)(_|$)/],
  ["location", /(^|_)(lat|latitude|lng|lon|longitude|geo|geohash|gps)(_|$)/],
  ["address", /(^|_)(address|addr|street|postcode|post_code|postal_code|zip|zip_code)(_?\d)?(_|$)/],
  ["health", /(^|_)(diagnosis|icd|medication|prescription|blood_type|allerg(y|ies)|medical|patient)(_|$)/],
  ["demographic", /(^|_)(gender|sex|race|ethnicity|religion|nationality|marital_status|sexual_orientation|disability)(_|$)/],
  ["name", /(^|_)((first|last|full|middle|given|family|sur|maiden)_?name|customer_name|contact_name|person_name|username)(_|$)/],
];

export interface PiiHint {
  column: string;
  category: PiiCategory;
  /** Always "name": the guess comes from what the column is called, never from its values. */
  basis: "name";
}

/**
 * Guesses which columns may hold personal data from their names alone. No
 * value is read, so it is safe on a source whose values are withheld, and it
 * will miss a badly named column: treat it as a starting list for a person
 * to review, not as a finding.
 */
export function piiHints(columns: string[]): PiiHint[] {
  return columns.flatMap((column) => {
    const snake = column
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .toLowerCase();
    const match = PATTERNS.find(([, pattern]) => pattern.test(snake));
    return match ? [{ column, category: match[0], basis: "name" as const }] : [];
  });
}
