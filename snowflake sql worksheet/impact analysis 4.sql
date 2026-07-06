USE ROLE X_IN_CAPG_POC_RWCX_AI_SCALABILITY_SOL;
USE WAREHOUSE W_IN_CAPG_AI_SCALABILITY_SOL_XS;
USE DATABASE D_IN_CAPG_POC_AI_SCALABILITY;
USE SCHEMA AI_SCALABILITY_SCHEMA;




-- =============================================================================
-- TEST IMPACT ANALYSIS WITH YOUR EXISTING PIPELINE
-- =============================================================================
-- Your pipeline structure:
--
--   LAYER 1 (RAW):   R_RAW_CUSTOMERS, R_RAW_ORDERS, R_RAW_PRODUCTS, R_RAW_PAYMENTS, R_RAW_SHIPPING
--   LAYER 2 (STG):   R_STG_CUSTOMERS, R_STG_ORDERS, R_STG_PRODUCTS, R_STG_PAYMENTS
--   LAYER 3 (FACT):  R_DIM_CUSTOMER, R_FACT_SALES, R_FACT_SHIPPING
--   LAYER 4 (MART):  R_MART_REVENUE_MONTHLY, R_MART_CUSTOMER_SEGMENTS, R_MART_SHIPPING_PERFORMANCE
--   LAYER 5 (VIEW):  VW_EXECUTIVE_DASHBOARD, VW_CUSTOMER_360, VW_PRODUCT_PERFORMANCE
--
-- External Sources: S3 (3), Postgres (1), Kafka (1), API (1), Azure Blob (1)
-- =============================================================================

USE DATABASE D_IN_CAPG_POC_AI_SCALABILITY;
USE SCHEMA AI_SCALABILITY_SCHEMA;

-- =============================================================================
-- TEST 1: HIGH RISK — Delete a staging table that feeds FACT + MART + VIEWS
-- Expected: 5+ objects affected, multiple HIGH severity (FACT_SALES, VW_EXECUTIVE_DASHBOARD)
-- =============================================================================
CALL GET_IMPACT_ANALYSIS(
  'NODE_DELETE',
  'D_IN_CAPG_POC_AI_SCALABILITY',
  'AI_SCALABILITY_SCHEMA',
  'R_STG_ORDERS',
  NULL,
  NULL
);
-- Expected result:
-- riskScore: 80+
-- impacts: R_FACT_SALES (dist 1, HIGH), R_FACT_SHIPPING (dist 1, HIGH),
--          R_MART_REVENUE_MONTHLY (dist 2, MODERATE/HIGH), VW_EXECUTIVE_DASHBOARD (dist 3, HIGH)

-- =============================================================================
-- TEST 2: MODERATE RISK — Rename column in RAW_CUSTOMERS
-- Expected: 3-4 objects affected (STG_CUSTOMERS → DIM_CUSTOMER → MART_CUSTOMER_SEGMENTS → VW_CUSTOMER_360)
-- =============================================================================
CALL GET_IMPACT_ANALYSIS(
  'COLUMN_RENAME',
  'D_IN_CAPG_POC_AI_SCALABILITY',
  'AI_SCALABILITY_SCHEMA',
  'R_RAW_CUSTOMERS',
  'EMAIL',
  NULL
);
-- Expected: Downstream objects at various distances, MODERATE severity mostly

-- =============================================================================
-- TEST 3: HIGH RISK — Delete the FACT_SALES table
-- Expected: Everything above it is affected (MART_REVENUE, VW_EXECUTIVE_DASHBOARD, VW_PRODUCT_PERFORMANCE)
-- =============================================================================
CALL GET_IMPACT_ANALYSIS(
  'NODE_DELETE',
  'D_IN_CAPG_POC_AI_SCALABILITY',
  'AI_SCALABILITY_SCHEMA',
  'R_FACT_SALES',
  NULL,
  NULL
);
-- Expected: HIGH for VW_EXECUTIVE_DASHBOARD, VW_CUSTOMER_360, VW_PRODUCT_PERFORMANCE

-- =============================================================================
-- TEST 4: LOW RISK — Add a column to R_RAW_PRODUCTS (additive, no breaking change)
-- Expected: All downstream objects listed but with WARNING severity (score < 40)
-- =============================================================================
CALL GET_IMPACT_ANALYSIS(
  'COLUMN_ADD',
  'D_IN_CAPG_POC_AI_SCALABILITY',
  'AI_SCALABILITY_SCHEMA',
  'R_RAW_PRODUCTS',
  'NEW_ATTRIBUTE',
  NULL
);
-- Expected: Low risk score (~10-25), all WARNING severity

-- =============================================================================
-- TEST 5: SOURCE DISCONNECT — What if S3 bucket stops feeding R_RAW_ORDERS?
-- Expected: HIGH because R_RAW_ORDERS feeds entire order pipeline
-- =============================================================================
CALL GET_IMPACT_ANALYSIS(
  'SOURCE_DISCONNECT',
  'D_IN_CAPG_POC_AI_SCALABILITY',
  'AI_SCALABILITY_SCHEMA',
  'R_RAW_ORDERS',
  NULL,
  NULL
);
-- Expected: HIGH severity for FACT_SALES and all downstream

-- =============================================================================
-- TEST 6: DEPENDENCY CHANGE — What if we change R_FACT_SALES to read from a different source?
-- Expected: MODERATE for downstream marts/views
-- =============================================================================
CALL GET_IMPACT_ANALYSIS(
  'DEPENDENCY_CHANGE',
  'D_IN_CAPG_POC_AI_SCALABILITY',
  'AI_SCALABILITY_SCHEMA',
  'R_FACT_SALES',
  NULL,
  NULL
);

-- =============================================================================
-- CHECK ALERTS GENERATED
-- =============================================================================

-- See all alerts generated from the tests above
SELECT ANALYSIS_ID, SEVERITY, ACTION_TYPE, SOURCE_NODE, AFFECTED_NODE, IMPACT_DISTANCE, RISK_SCORE, WILL_BREAK
FROM R_IMPACT_ALERTS
ORDER BY TIMESTAMP DESC
LIMIT 30;

-- Summary of alerts by severity
SELECT SEVERITY, COUNT(*) AS ALERT_COUNT, AVG(RISK_SCORE) AS AVG_RISK
FROM R_IMPACT_ALERTS
GROUP BY SEVERITY
ORDER BY SEVERITY;

-- Check audit log
SELECT ANALYSIS_ID, ACTION_TYPE, TARGET_OBJECT, TOTAL_AFFECTED, HIGH_COUNT, MODERATE_COUNT, WARNING_COUNT, RISK_SCORE, EXECUTION_TIME_MS
FROM R_IMPACT_AUDIT_LOG
ORDER BY TIMESTAMP DESC;

-- =============================================================================
-- TEST FROM FRONTEND (use these in the Impact Analysis panel):
-- =============================================================================
/*
  In the Lineage Graph page:

  1. Generate lineage for R_FACT_SALES (direction: BOTH, distance: 3)
  2. Right-click on R_STG_ORDERS node → "Analyze Impact"
  3. Select action: "Delete Object" → Click "Analyze"
  4. You should see:
     - Risk Score: 70-90+
     - HIGH: R_FACT_SALES, VW_EXECUTIVE_DASHBOARD
     - MODERATE: R_MART_REVENUE_MONTHLY, R_MART_CUSTOMER_SEGMENTS
     - WARNING: Others

  5. Check the Alert Loader panel below — new alerts should appear
  6. Try clicking "Confirm Change Executed" on one alert
  7. See it change from PLANNED → EXECUTED (purple badge)

  Other good tests from the UI:
  - Analyze Impact on R_RAW_CUSTOMERS → shows full cascade to VW_CUSTOMER_360
  - Analyze Impact on R_MART_REVENUE_MONTHLY → shows only VW_EXECUTIVE_DASHBOARD affected
  - Analyze Impact on VW_EXECUTIVE_DASHBOARD → shows 0 affected (it's a leaf node!)
*/
