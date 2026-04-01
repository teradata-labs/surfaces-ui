/**
 * Teradata EXPLAIN Sample Data
 * From live Titanic EXPLAIN session (March 2026)
 * 
 * 3 queries demonstrating different EXPLAIN patterns and optimizer behaviors
 */

import type { TeradataQuery } from './teradata-types';

export const TERADATA_SAMPLE_QUERIES: TeradataQuery[] = [
  {
    name: 'Survival by class & gender',
    sql: `SELECT
  pclass,
  sex,
  COUNT(*) AS total,
  SUM(survived) AS survived,
  CAST(SUM(survived) AS FLOAT) / COUNT(*) * 100 AS survival_rate_pct,
  AVG(CAST(fare AS FLOAT)) AS avg_fare
FROM DEMO_TitanicSurvival.Passenger_Data
GROUP BY pclass, sex
ORDER BY pclass, sex`,
    raw: `1) First, we lock DEMO_TitanicSurvival_db.Passenger_Data in view
   DEMO_TitanicSurvival.Passenger_Data in TD_MAP2 for access.
2) Next, we do an all-AMPs SUM step in TD_MAP2 to aggregate from
   DEMO_TitanicSurvival_db.Passenger_Data by way of an all-rows scan
   with no residual conditions, grouping by field1 (pclass, sex).
   Spool 3 estimated with no confidence: 756 rows (40,824 bytes). 0.01s.
3) All-AMPs RETRIEVE from Spool 3 into Spool 1, SORT by pclass, sex.
   Spool 1 estimated with no confidence: 756 rows (52,164 bytes). 0.01s.
4) END TRANSACTION. Total estimated time: 0.02 seconds.`,
    steps: [
      {
        type: 'lock',
        label: 'Access lock',
        sub: 'Passenger_Data',
        confidence: '',
        scanType: 'Table lock',
        rows: '',
        bytes: '',
        time: '',
        obs: ['View DEMO_TitanicSurvival resolves to DEMO_TitanicSurvival_db'],
        rewrites: [],
      },
      {
        type: 'agg',
        label: 'All-AMPs aggregate',
        sub: 'GROUP BY pclass, sex',
        confidence: 'none',
        scanType: 'All-rows scan',
        rows: '756',
        bytes: '40,824',
        time: '0.01s',
        obs: [
          'No residual conditions — full 891-row table scan',
          'No statistics on pclass or sex — optimizer guessed 756 rows (actual: 6)',
        ],
        rewrites: [],
      },
      {
        type: 'sort',
        label: 'Retrieve + sort',
        sub: 'ORDER BY pclass, sex',
        confidence: 'none',
        scanType: 'Spool sort',
        rows: '756',
        bytes: '52,164',
        time: '0.01s',
        obs: ['Sort on raw column pair — correct choice for 6 output groups'],
        rewrites: [],
      },
      {
        type: 'return',
        label: 'Return results',
        sub: '→ client',
        confidence: '',
        scanType: '',
        rows: '',
        bytes: '',
        time: '0.02s total',
        obs: ['Total estimated time: 0.02s'],
        rewrites: [],
      },
    ],
    highlights: {
      lock: 'DEMO_TitanicSurvival.Passenger_Data',
      agg: 'GROUP BY pclass, sex',
      sort: 'ORDER BY pclass, sex',
      return: 'SELECT',
    },
  },
  {
    name: 'Age group bucketing',
    sql: `SELECT
  CASE
    WHEN age IS NULL THEN 'Unknown'
    WHEN age < 13 THEN 'Child (0-12)'
    WHEN age < 18 THEN 'Teen (13-17)'
    WHEN age < 35 THEN 'Young Adult (18-34)'
    WHEN age < 60 THEN 'Middle Age (35-59)'
    ELSE 'Senior (60+)'
  END AS age_group,
  COUNT(*) AS total,
  SUM(survived) AS survived,
  CAST(SUM(survived) AS FLOAT) / COUNT(*) * 100 AS survival_rate_pct
FROM DEMO_TitanicSurvival.Passenger_Data
GROUP BY 1
ORDER BY survival_rate_pct DESC`,
    raw: `1) Lock DEMO_TitanicSurvival_db.Passenger_Data in view for access.
2) All-AMPs SUM step, all-rows scan, grouping by CASE WHEN age IS NULL
   THEN 'Unknown' WHEN age <= 12 THEN 'Child (0-12)' ...
   Spool 3 estimated with LOW confidence: 6 rows (426 bytes). 0.01s.
3) RETRIEVE from Spool 3, SORT by ((SUM(Field_2)(FLOAT))/(COUNT(1)(INTEGER)))*100.
   Spool 1 estimated with LOW confidence: 6 rows (348 bytes). 0.01s.
4) END TRANSACTION. Total estimated time: 0.02 seconds.`,
    steps: [
      {
        type: 'lock',
        label: 'Access lock',
        sub: 'Passenger_Data',
        confidence: '',
        scanType: 'Table lock',
        rows: '',
        bytes: '',
        time: '',
        obs: ['View resolves to DEMO_TitanicSurvival_db.Passenger_Data'],
        rewrites: [],
      },
      {
        type: 'agg',
        label: 'All-AMPs aggregate',
        sub: 'GROUP BY CASE(age)',
        confidence: 'low',
        scanType: 'All-rows scan',
        rows: '6',
        bytes: '426',
        time: '0.01s',
        obs: [
          'Low confidence — optimizer inferred 6 groups from CASE branch count',
          '19.9% of age values are NULL — handled correctly by WHEN age IS NULL',
        ],
        rewrites: ['age < 13 → age <= 12 (integer boundary optimization)'],
      },
      {
        type: 'sort',
        label: 'Retrieve + sort',
        sub: 'ORDER BY computed expr',
        confidence: 'low',
        scanType: 'Spool sort',
        rows: '6',
        bytes: '348',
        time: '0.01s',
        obs: [
          "survived aliased as 'Field_2' internally — GROUP BY 1 ordinal creates anonymous field",
          'Sort on computed expression (SUM/COUNT)*100',
        ],
        rewrites: [],
      },
      {
        type: 'return',
        label: 'Return results',
        sub: '→ client',
        confidence: '',
        scanType: '',
        rows: '',
        bytes: '',
        time: '0.02s total',
        obs: ['Total estimated time: 0.02s'],
        rewrites: [],
      },
    ],
    highlights: {
      lock: 'DEMO_TitanicSurvival.Passenger_Data',
      agg: 'GROUP BY 1',
      sort: 'ORDER BY survival_rate_pct DESC',
      return: 'SELECT',
    },
  },
  {
    name: 'Family size analysis',
    sql: `SELECT
  CASE WHEN sibsp + parch = 0 THEN 'Alone'
       WHEN sibsp + parch <= 3 THEN 'Small Family (1-3)'
       ELSE 'Large Family (4+)'
  END AS family_size,
  COUNT(*) AS total,
  SUM(survived) AS survived,
  CAST(SUM(survived) AS FLOAT) / COUNT(*) * 100 AS survival_rate_pct
FROM DEMO_TitanicSurvival.Passenger_Data
GROUP BY 1
ORDER BY survival_rate_pct DESC`,
    raw: `1) Lock DEMO_TitanicSurvival_db.Passenger_Data in view for access.
2) All-AMPs SUM step, all-rows scan, grouping by CASE WHEN
   (sibsp + parch) = 0 THEN 'Alone' WHEN (sibsp + parch) <= 3
   THEN 'Small Family (1-3)' ELSE 'Large Family (4+)' END.
   Spool 3 estimated with LOW confidence: 3 rows (207 bytes). 0.01s.
3) RETRIEVE from Spool 3, SORT by ((SUM(Field_2)(FLOAT))/(COUNT(1)(INTEGER)))*100.
   Spool 1 estimated with LOW confidence: 3 rows (171 bytes). 0.01s.
4) END TRANSACTION. Total estimated time: 0.02 seconds.`,
    steps: [
      {
        type: 'lock',
        label: 'Access lock',
        sub: 'Passenger_Data',
        confidence: '',
        scanType: 'Table lock',
        rows: '',
        bytes: '',
        time: '',
        obs: ['View resolves to DEMO_TitanicSurvival_db.Passenger_Data'],
        rewrites: [],
      },
      {
        type: 'agg',
        label: 'All-AMPs aggregate',
        sub: 'GROUP BY CASE(sibsp+parch)',
        confidence: 'low',
        scanType: 'All-rows scan',
        rows: '3',
        bytes: '207',
        time: '0.01s',
        obs: [
          'sibsp + parch arithmetic evaluated TWICE per row — once per CASE branch',
          'At 500M rows this redundancy becomes significant CPU cost',
        ],
        rewrites: [],
      },
      {
        type: 'sort',
        label: 'Retrieve + sort',
        sub: 'ORDER BY computed expr',
        confidence: 'low',
        scanType: 'Spool sort',
        rows: '3',
        bytes: '171',
        time: '0.01s',
        obs: ["survived aliased as 'Field_2' — same GROUP BY 1 ordinal pattern as query 2"],
        rewrites: [],
      },
      {
        type: 'return',
        label: 'Return results',
        sub: '→ client',
        confidence: '',
        scanType: '',
        rows: '',
        bytes: '',
        time: '0.02s total',
        obs: ['Total estimated time: 0.02s'],
        rewrites: [],
      },
    ],
    highlights: {
      lock: 'DEMO_TitanicSurvival.Passenger_Data',
      agg: 'GROUP BY 1',
      sort: 'ORDER BY survival_rate_pct DESC',
      return: 'SELECT',
    },
  },
];
