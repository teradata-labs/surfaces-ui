import { CITIES, FIRST, LAST, fakePhone, prelude, rows, withDefaults } from "../sql.js";
import { withStarters } from "../starters.js";
import type { Seed, SeedForm, SeedPipeline, SeedTable } from "../types.js";

const SYNTHETIC = "Synthetic: no real patient, provider or record.";

const DIAGNOSES = `[
  {'code': 'E11.9', 'text': 'Type 2 diabetes without complications'},
  {'code': 'I10', 'text': 'Essential hypertension'},
  {'code': 'J06.9', 'text': 'Acute upper respiratory infection'},
  {'code': 'M54.5', 'text': 'Low back pain'},
  {'code': 'F41.1', 'text': 'Generalized anxiety disorder'},
  {'code': 'E78.5', 'text': 'Hyperlipidemia'},
  {'code': 'J45.909', 'text': 'Asthma, uncomplicated'},
  {'code': 'N39.0', 'text': 'Urinary tract infection'},
  {'code': 'I25.10', 'text': 'Coronary artery disease'},
  {'code': 'K21.9', 'text': 'Gastro-esophageal reflux disease'},
  {'code': 'S93.401A', 'text': 'Sprain of ankle'},
  {'code': 'Z00.00', 'text': 'General adult examination'}
]`;
const PROCEDURES = `[
  {'code': '99213', 'text': 'Office visit, established patient, low complexity', 'price': 120},
  {'code': '99214', 'text': 'Office visit, established patient, moderate complexity', 'price': 180},
  {'code': '99285', 'text': 'Emergency department visit, high severity', 'price': 950},
  {'code': '80053', 'text': 'Comprehensive metabolic panel', 'price': 45},
  {'code': '85025', 'text': 'Complete blood count', 'price': 30},
  {'code': '71046', 'text': 'Chest X-ray, two views', 'price': 140},
  {'code': '93000', 'text': 'Electrocardiogram', 'price': 60},
  {'code': '99223', 'text': 'Initial hospital care, high complexity', 'price': 420}
]`;

const tables: SeedTable[] = [
  {
    name: "providers",
    description: `Clinicians who see patients, with their specialty and facility. ${SYNTHETIC}`,
    grain: "one row per provider",
    primaryKey: ["provider_id"],
    columns: [
      { name: "provider_id", type: "INTEGER", description: "Provider identifier." },
      { name: "provider_name", type: "VARCHAR", description: "Name.", pii: "name" },
      { name: "specialty", type: "VARCHAR", description: "Clinical specialty." },
      { name: "facility", type: "VARCHAR", description: "Where they practise." },
      { name: "npi", type: "VARCHAR", description: "National provider number. Invented: starts with 9, which real numbers never do." },
    ],
  },
  {
    name: "patients",
    description: `People registered with the health system. ${SYNTHETIC}`,
    grain: "one row per patient",
    primaryKey: ["patient_id"],
    columns: [
      { name: "patient_id", type: "INTEGER", description: "Patient identifier." },
      { name: "mrn", type: "VARCHAR", description: "Medical record number.", pii: "government_id" },
      { name: "first_name", type: "VARCHAR", description: "Given name.", pii: "name" },
      { name: "last_name", type: "VARCHAR", description: "Family name.", pii: "name" },
      { name: "birth_date", type: "DATE", description: "Date of birth.", pii: "birth_date" },
      { name: "sex", type: "VARCHAR", description: "F, M or X." },
      { name: "city", type: "VARCHAR", description: "Home city.", pii: "location" },
      { name: "phone", type: "VARCHAR", description: "Phone number.", pii: "phone" },
      { name: "insurance_type", type: "VARCHAR", description: "commercial, medicare, medicaid or self-pay." },
    ],
  },
  {
    name: "encounters",
    description: `Visits and stays: outpatient, inpatient, emergency and telehealth. ${SYNTHETIC}`,
    grain: "one row per encounter",
    primaryKey: ["encounter_id"],
    columns: [
      { name: "encounter_id", type: "INTEGER", description: "Encounter identifier." },
      { name: "patient_id", type: "INTEGER", description: "The patient." },
      { name: "provider_id", type: "INTEGER", description: "The attending provider." },
      { name: "encounter_type", type: "VARCHAR", description: "outpatient, inpatient, emergency or telehealth." },
      { name: "admitted_at", type: "TIMESTAMP", description: "Start, UTC." },
      { name: "discharged_at", type: "TIMESTAMP", description: "End, UTC." },
      { name: "readmitted_within_30d", type: "BOOLEAN", description: "An inpatient stay followed by another within 30 days." },
    ],
    foreignKeys: [
      { column: "patient_id", table: "patients", references: "patient_id" },
      { column: "provider_id", table: "providers", references: "provider_id" },
    ],
  },
  {
    name: "diagnoses",
    description: `Conditions recorded at an encounter, as ICD-10 codes. ${SYNTHETIC}`,
    grain: "one row per diagnosis on an encounter",
    primaryKey: ["encounter_id", "seq"],
    columns: [
      { name: "encounter_id", type: "INTEGER", description: "The encounter." },
      { name: "seq", type: "INTEGER", description: "Order recorded; 1 is the primary diagnosis." },
      { name: "icd10_code", type: "VARCHAR", description: "ICD-10-CM code.", pii: "health" },
      { name: "description", type: "VARCHAR", description: "What the code means." },
    ],
    foreignKeys: [{ column: "encounter_id", table: "encounters", references: "encounter_id" }],
  },
  {
    name: "procedures",
    description: `Services performed at an encounter, as CPT codes with their charge. ${SYNTHETIC}`,
    grain: "one row per procedure on an encounter",
    primaryKey: ["encounter_id", "seq"],
    columns: [
      { name: "encounter_id", type: "INTEGER", description: "The encounter." },
      { name: "seq", type: "INTEGER", description: "Order performed." },
      { name: "cpt_code", type: "VARCHAR", description: "CPT code." },
      { name: "description", type: "VARCHAR", description: "What was done." },
      { name: "charge", type: "DECIMAL(10,2)", description: "List charge, USD." },
    ],
    foreignKeys: [{ column: "encounter_id", table: "encounters", references: "encounter_id" }],
  },
  {
    name: "claims",
    description: `Bills sent to payers for an encounter and what was paid. ${SYNTHETIC}`,
    grain: "one row per claim",
    primaryKey: ["claim_id"],
    columns: [
      { name: "claim_id", type: "INTEGER", description: "Claim identifier." },
      { name: "encounter_id", type: "INTEGER", description: "The encounter billed." },
      { name: "payer", type: "VARCHAR", description: "Who was billed; empty when not recorded." },
      { name: "billed_amount", type: "DECIMAL(12,2)", description: "Billed, USD." },
      { name: "allowed_amount", type: "DECIMAL(12,2)", description: "What the payer allows, USD." },
      { name: "paid_amount", type: "DECIMAL(12,2)", description: "Paid, USD." },
      { name: "status", type: "VARCHAR", description: "paid, denied or pending." },
      { name: "submitted_on", type: "DATE", description: "Day submitted." },
      { name: "paid_on", type: "DATE", description: "Day paid, if paid." },
    ],
    foreignKeys: [{ column: "encounter_id", table: "encounters", references: "encounter_id" }],
  },
  {
    name: "medications",
    description: `Prescriptions written at an encounter. ${SYNTHETIC}`,
    grain: "one row per prescription",
    primaryKey: ["prescription_id"],
    columns: [
      { name: "prescription_id", type: "INTEGER", description: "Prescription identifier." },
      { name: "encounter_id", type: "INTEGER", description: "Where it was written." },
      { name: "patient_id", type: "INTEGER", description: "For whom." },
      { name: "drug_name", type: "VARCHAR", description: "Generic name.", pii: "health" },
      { name: "dose", type: "VARCHAR", description: "Strength and frequency." },
      { name: "start_date", type: "DATE", description: "First day." },
      { name: "days_supply", type: "INTEGER", description: "Days it lasts." },
    ],
    foreignKeys: [
      { column: "encounter_id", table: "encounters", references: "encounter_id" },
      { column: "patient_id", table: "patients", references: "patient_id" },
    ],
  },
];

const form: SeedForm = {
  id: "healthcare-chart-review",
  title: "Chart review",
  description: "A coder's check of an encounter's documentation before the claim goes out.",
  table: "chart_reviews",
  fields: [
    { name: "encounter_id", label: "Encounter", type: "integer", required: true, min: 1 },
    { name: "outcome", label: "Outcome", type: "choice", required: true, options: ["Codes correct", "Codes changed", "Query the clinician"] },
    { name: "corrected_code", label: "Corrected primary code", type: "text", pattern: "[A-Z][0-9]{2}(\\.[0-9A-Z]{1,4})?", help: "ICD-10-CM, such as E11.9. Leave empty if unchanged." },
    { name: "minutes_spent", label: "Minutes spent", type: "integer", min: 0, max: 240 },
    { name: "notes", label: "Notes", type: "longtext", maxLength: 1000, help: "Do not paste anything from outside this record." },
  ],
};

const pipeline: SeedPipeline = {
  id: "healthcare-quality",
  name: "Readmissions and claims pipeline",
  description: "Joins stays with their primary diagnosis, then builds readmission rates by condition and claim denial rates by payer.",
  datasets: [
    {
      name: "inpatient_stays",
      kind: "view",
      layer: "silver",
      description: "Inpatient encounters with length of stay and primary diagnosis, leaving out stays that end before they start.",
      sql: "SELECT e.encounter_id, e.patient_id, e.admitted_at, e.discharged_at, date_diff('day', e.admitted_at, e.discharged_at) AS length_of_stay, e.readmitted_within_30d, d.icd10_code, d.description AS diagnosis FROM encounters e JOIN diagnoses d ON d.encounter_id = e.encounter_id AND d.seq = 1 WHERE e.encounter_type = 'inpatient'",
      expectations: [{ name: "ends_after_start", constraint: "discharged_at >= admitted_at", action: "drop" }],
    },
    {
      name: "readmission_by_condition",
      layer: "gold",
      description: "Stays, readmissions and readmission rate by primary diagnosis.",
      sql: "SELECT icd10_code, diagnosis, COUNT(*) AS stays, SUM(CASE WHEN readmitted_within_30d THEN 1 ELSE 0 END) AS readmissions, AVG(CASE WHEN readmitted_within_30d THEN 1.0 ELSE 0.0 END) AS readmission_rate FROM inpatient_stays GROUP BY 1, 2",
    },
    {
      name: "denials_by_payer",
      layer: "gold",
      description: "Claims, denials and denial rate by payer.",
      sql: "SELECT coalesce(payer, 'Not recorded') AS payer, COUNT(*) AS claims, SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) AS denied, AVG(CASE WHEN status = 'denied' THEN 1.0 ELSE 0.0 END) AS denial_rate FROM claims GROUP BY 1",
      expectations: [{ name: "rate_is_a_fraction", constraint: "denial_rate BETWEEN 0 AND 1", action: "fail" }],
    },
  ],
};

export const healthcare: Seed = {
  id: "healthcare",
  title: "Healthcare",
  industry: "Healthcare",
  description: `A health system's patients, clinicians, visits, diagnoses, procedures, claims and prescriptions. ${SYNTHETIC}`,
  tables,
  issues: [
    { table: "encounters", column: "discharged_at", kind: "inconsistent", description: "A few stays end before they start.", sql: "SELECT * FROM encounters WHERE discharged_at < admitted_at" },
    { table: "claims", column: "paid_amount", kind: "out_of_range", description: "Some claims were paid more than the allowed amount.", sql: "SELECT * FROM claims WHERE paid_amount > allowed_amount" },
    { table: "claims", column: "payer", kind: "nulls", description: "About 1% of claims have no payer recorded.", sql: "SELECT * FROM claims WHERE payer IS NULL" },
  ],
  sql(params) {
    const p = withDefaults(params);
    const nPatients = rows(3000, p);
    const nEncounters = rows(15000, p);
    return [
      ...prelude(p),
      `CREATE OR REPLACE TABLE providers AS
       SELECT CAST(i + 1 AS INTEGER) AS provider_id,
         'Dr ' || sf_pick(${FIRST}, i, 101) || ' ' || sf_pick(${LAST}, i, 102) AS provider_name,
         sf_pick(['Family medicine', 'Internal medicine', 'Cardiology', 'Emergency medicine', 'Pediatrics', 'Orthopedics', 'Psychiatry', 'Hospitalist'], i, 103) AS specialty,
         sf_pick(['Riverton General', 'Lakeside Clinic', 'Northgate Medical Center', 'Fairview Health'], i, 104) AS facility,
         '9' || lpad(CAST(sf_int(i, 105, 0, 999999999) AS VARCHAR), 9, '0') AS npi
       FROM range(150) r(i)`,
      `CREATE OR REPLACE TABLE patients AS
       SELECT CAST(i + 1 AS INTEGER) AS patient_id,
         'MRN' || lpad(CAST(sf_int(i, 111, 0, 9999999) AS VARCHAR), 7, '0') AS mrn,
         sf_pick(${FIRST}, i, 112) AS first_name, sf_pick(${LAST}, i, 113) AS last_name,
         DATE '${p.start}' - CAST(sf_int(i, 114, 30, 32000) AS INTEGER) AS birth_date,
         sf_pick(['F', 'F', 'M', 'M', 'X'], i, 115) AS sex,
         sf_pick(${CITIES}, i, 116) AS city,
         ${fakePhone("i", 117)} AS phone,
         sf_pick(['commercial', 'commercial', 'commercial', 'medicare', 'medicare', 'medicaid', 'self-pay'], i, 118) AS insurance_type
       FROM range(${nPatients}) r(i)`,
      `CREATE OR REPLACE TABLE encounters AS
       WITH base AS (
         SELECT i, CAST(1 + floor(pow(sf_rnd(i, 121), 1.5) * ${nPatients}) AS INTEGER) AS patient_id,
           sf_pick(['outpatient', 'outpatient', 'outpatient', 'outpatient', 'telehealth', 'telehealth', 'emergency', 'inpatient'], i, 122) AS encounter_type,
           sf_ts(i, 123) AS admitted_at
         FROM range(${nEncounters}) r(i))
       SELECT CAST(i + 1 AS INTEGER) AS encounter_id, patient_id, CAST(sf_int(i, 124, 1, 150) AS INTEGER) AS provider_id, encounter_type, admitted_at,
         CASE
           WHEN sf_rnd(i, 125) < 0.003 THEN admitted_at - INTERVAL 2 HOUR
           WHEN encounter_type = 'inpatient' THEN admitted_at + to_hours(sf_int(i, 126, 24, 24 * 9))
           WHEN encounter_type = 'emergency' THEN admitted_at + to_minutes(sf_int(i, 126, 90, 600))
           ELSE admitted_at + to_minutes(sf_int(i, 126, 15, 60)) END AS discharged_at,
         encounter_type = 'inpatient' AND sf_rnd(i, 127) < 0.14 AS readmitted_within_30d
       FROM base`,
      `CREATE OR REPLACE TABLE diagnoses AS
       WITH d AS (SELECT ${DIAGNOSES} AS codes)
       SELECT e.encounter_id, CAST(s.seq AS INTEGER) AS seq,
         d.codes[CAST(1 + floor(sf_rnd(e.encounter_id * 7 + s.seq, 131) * len(d.codes)) AS INTEGER)].code AS icd10_code,
         d.codes[CAST(1 + floor(sf_rnd(e.encounter_id * 7 + s.seq, 131) * len(d.codes)) AS INTEGER)].text AS description
       FROM encounters e, d, range(1, CAST(sf_int(e.encounter_id, 132, 2, 4) AS BIGINT)) s(seq)`,
      `CREATE OR REPLACE TABLE procedures AS
       WITH c AS (SELECT ${PROCEDURES} AS codes)
       SELECT e.encounter_id, CAST(s.seq AS INTEGER) AS seq,
         c.codes[CAST(1 + floor(sf_rnd(e.encounter_id * 7 + s.seq, 141) * len(c.codes)) AS INTEGER)].code AS cpt_code,
         c.codes[CAST(1 + floor(sf_rnd(e.encounter_id * 7 + s.seq, 141) * len(c.codes)) AS INTEGER)].text AS description,
         CAST(c.codes[CAST(1 + floor(sf_rnd(e.encounter_id * 7 + s.seq, 141) * len(c.codes)) AS INTEGER)].price * (0.9 + sf_rnd(e.encounter_id, 142) * 0.3) AS DECIMAL(10,2)) AS charge
       FROM encounters e, c, range(1, CAST(CASE WHEN e.encounter_type = 'inpatient' THEN sf_int(e.encounter_id, 143, 3, 6) ELSE sf_int(e.encounter_id, 143, 2, 3) END AS BIGINT)) s(seq)`,
      `CREATE OR REPLACE TABLE claims AS
       WITH billed AS (SELECT encounter_id, SUM(charge) AS billed FROM procedures GROUP BY encounter_id)
       SELECT CAST(row_number() OVER (ORDER BY e.encounter_id) AS INTEGER) AS claim_id, e.encounter_id,
         CASE WHEN sf_rnd(e.encounter_id, 151) < 0.01 THEN NULL
              WHEN p.insurance_type = 'self-pay' THEN 'Self-pay'
              WHEN p.insurance_type = 'commercial' THEN sf_pick(['Acme Health', 'Blue Lake Mutual', 'Summit Care'], e.encounter_id, 152)
              ELSE CASE p.insurance_type WHEN 'medicare' THEN 'Medicare' ELSE 'Medicaid' END END AS payer,
         CAST(b.billed AS DECIMAL(12,2)) AS billed_amount,
         CAST(round(b.billed * (0.45 + sf_rnd(e.encounter_id, 153) * 0.3), 2) AS DECIMAL(12,2)) AS allowed_amount,
         CAST(CASE WHEN sf_rnd(e.encounter_id, 154) < 0.09 THEN 0
                   WHEN sf_rnd(e.encounter_id, 155) < 0.005 THEN round(b.billed * 0.95, 2)
                   ELSE round(b.billed * (0.45 + sf_rnd(e.encounter_id, 153) * 0.3) * 0.9, 2) END AS DECIMAL(12,2)) AS paid_amount,
         CASE WHEN sf_rnd(e.encounter_id, 154) < 0.09 THEN 'denied' WHEN sf_rnd(e.encounter_id, 156) < 0.05 THEN 'pending' ELSE 'paid' END AS status,
         CAST(e.discharged_at AS DATE) + CAST(sf_int(e.encounter_id, 157, 1, 10) AS INTEGER) AS submitted_on,
         CASE WHEN sf_rnd(e.encounter_id, 154) < 0.09 OR sf_rnd(e.encounter_id, 156) < 0.05 THEN NULL ELSE CAST(e.discharged_at AS DATE) + CAST(sf_int(e.encounter_id, 158, 12, 60) AS INTEGER) END AS paid_on
       FROM encounters e JOIN billed b ON b.encounter_id = e.encounter_id JOIN patients p ON p.patient_id = e.patient_id`,
      `CREATE OR REPLACE TABLE medications AS
       SELECT CAST(row_number() OVER (ORDER BY e.encounter_id) AS INTEGER) AS prescription_id, e.encounter_id, e.patient_id,
         sf_pick(['metformin', 'lisinopril', 'atorvastatin', 'amoxicillin', 'albuterol', 'sertraline', 'omeprazole', 'ibuprofen', 'amlodipine'], e.encounter_id, 161) AS drug_name,
         sf_pick(['10 mg once daily', '20 mg once daily', '500 mg twice daily', '250 mg three times daily', '2 puffs as needed'], e.encounter_id, 162) AS dose,
         CAST(e.discharged_at AS DATE) AS start_date,
         CAST(sf_pick([7, 10, 30, 30, 90], e.encounter_id, 163) AS INTEGER) AS days_supply
       FROM encounters e WHERE sf_rnd(e.encounter_id, 164) < 0.45`,
    ];
  },
  forms: [form],
  pipelines: [pipeline],
  ...withStarters({
    sourceId: "healthcare",
    title: "Healthcare",
    tables,
    form,
    formContext: "Before a claim goes out, check that the encounter's codes match its documentation. Everything here is synthetic.",
    pipeline,
    explore: { table: "encounters", sql: "SELECT * FROM encounters", sorts: [{ column: "admitted_at", desc: true }] },
    model: ["patients", "encounters", "providers", "diagnoses", "procedures", "claims"],
    dashboard: {
      title: "Care and claims",
      description: "Encounters, readmissions and claims paid, by month, type and payer. Synthetic data.",
      metrics: [
        { label: "Encounters", sql: "SELECT encounter_id FROM encounters", column: "encounter_id", aggregate: "count", format: "compact" },
        { label: "Patients seen", sql: "SELECT patient_id FROM encounters", column: "patient_id", aggregate: "count_distinct", format: "compact" },
        { label: "Paid", sql: "SELECT paid_amount FROM claims", column: "paid_amount", aggregate: "sum", format: "currency" },
      ],
      trend: { label: "Encounters by month", sql: "SELECT admitted_at, encounter_id FROM encounters", x: "admitted_at", column: "encounter_id", aggregate: "count", format: "number" },
      charts: [
        { label: "Encounters by type", sql: "SELECT encounter_type, encounter_id FROM encounters", type: "bar", x: "encounter_type", y: [{ column: "encounter_id", aggregate: "count", label: "Encounters" }] },
        { label: "Most common primary diagnoses", sql: "SELECT description, encounter_id FROM diagnoses WHERE seq = 1", type: "bar", x: "description", y: [{ column: "encounter_id", aggregate: "count", label: "Encounters" }] },
        { label: "Paid by payer", sql: "SELECT coalesce(payer, 'Not recorded') AS payer, paid_amount FROM claims", type: "bar", x: "payer", y: [{ column: "paid_amount", aggregate: "sum", label: "Paid" }], yTitle: "Paid (USD)" },
        { label: "Emergency visits by month", sql: "SELECT admitted_at, encounter_id FROM encounters WHERE encounter_type = 'emergency'", type: "line", x: "admitted_at", xGrain: "month", y: [{ column: "encounter_id", aggregate: "count", label: "Visits" }] },
      ],
    },
  }),
};
