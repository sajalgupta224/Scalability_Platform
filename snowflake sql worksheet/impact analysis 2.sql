USE ROLE X_IN_CAPG_POC_RWCX_AI_SCALABILITY_SOL;
USE WAREHOUSE W_IN_CAPG_AI_SCALABILITY_SOL_XS;
USE DATABASE D_IN_CAPG_POC_AI_SCALABILITY;
USE SCHEMA AI_SCALABILITY_SCHEMA;



-- =============================================================================
-- IMPACT ANALYSIS — TEST DATA & DEMO SCENARIOS
-- =============================================================================
-- Run this in Snowsight after running 05_impact_analysis_tables.sql
-- This inserts sample rules, historical alerts, and provides test queries
-- =============================================================================

USE DATABASE D_IN_CAPG_POC_AI_SCALABILITY;
USE SCHEMA AI_SCALABILITY_SCHEMA;

-- =============================================================================
-- SECTION 1: Insert Custom Impact Rules
-- =============================================================================

-- Rule 1: Executive-facing views are always HIGH priority
INSERT INTO R_IMPACT_RULES (RULE_NAME, RULE_DESCRIPTION, CONDITION_TYPE, CONDITION_VALUE, SEVERITY_OVERRIDE, SEVERITY_MODIFIER)
SELECT
  'Executive Dashboard Protection',
  'Any change affecting executive-facing views or dashboards is HIGH severity',
  'NODE_PATTERN',
  PARSE_JSON('{"pattern": "EXECUTIVE"}'),
  'HIGH',
  0;

-- Rule 2: Objects with >10 downstream consumers are critical hubs
INSERT INTO R_IMPACT_RULES (RULE_NAME, RULE_DESCRIPTION, CONDITION_TYPE, CONDITION_VALUE, SEVERITY_OVERRIDE, SEVERITY_MODIFIER)
SELECT
  'Hub Node Protection',
  'Tables with more than 10 downstream consumers are critical infrastructure',
  'DOWNSTREAM_COUNT',
  PARSE_JSON('{"threshold": 10}'),
  NULL,
  20;

-- Rule 3: Fact tables bump severity by 15
INSERT INTO R_IMPACT_RULES (RULE_NAME, RULE_DESCRIPTION, CONDITION_TYPE, CONDITION_VALUE, SEVERITY_OVERRIDE, SEVERITY_MODIFIER)
SELECT
  'Fact Table Critical',
  'Fact tables are key aggregation points - changes have broad impact',
  'NODE_PATTERN',
  PARSE_JSON('{"pattern": "FACT"}'),
  NULL,
  15;

-- Rule 4: KPI reports are always moderate minimum
INSERT INTO R_IMPACT_RULES (RULE_NAME, RULE_DESCRIPTION, CONDITION_TYPE, CONDITION_VALUE, SEVERITY_OVERRIDE, SEVERITY_MODIFIER)
SELECT
  'KPI Report Sensitivity',
  'KPI reports feed business decisions - minimum MODERATE severity',
  'NODE_PATTERN',
  PARSE_JSON('{"pattern": "KPI"}'),
  'MODERATE',
  0;

-- Rule 5: External sources with no backup → HIGH
INSERT INTO R_IMPACT_RULES (RULE_NAME, RULE_DESCRIPTION, CONDITION_TYPE, CONDITION_VALUE, SEVERITY_OVERRIDE, SEVERITY_MODIFIER)
SELECT
  'Single External Source Risk',
  'If an external source has no registered backup, disconnection is HIGH risk',
  'EXTERNAL_SOURCE',
  PARSE_JSON('{"requireBackup": true}'),
  'HIGH',
  0;

-- =============================================================================
-- SECTION 2: Insert Sample Historical Alerts (for Alert Loader demo)
-- =============================================================================

-- Alert 1: HIGH - Someone analyzed deleting a staging table
INSERT INTO R_IMPACT_ALERTS (ANALYSIS_ID, SEVERITY, ACTION_TYPE, SOURCE_NODE, AFFECTED_NODE, AFFECTED_NODE_TYPE, IMPACT_DISTANCE, IMPACT_DESCRIPTION, WILL_BREAK, RISK_SCORE, CREATED_BY)
VALUES (
  'demo-analysis-001',
  'HIGH',
  'NODE_DELETE',
  'D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_STG_ORDERS',
  'D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_FACT_SALES',
  'TABLE',
  1,
  'Deleting R_STG_ORDERS will BREAK R_FACT_SALES (1 hop downstream). Direct MERGE dependency.',
  TRUE,
  92
);

INSERT INTO R_IMPACT_ALERTS (ANALYSIS_ID, SEVERITY, ACTION_TYPE, SOURCE_NODE, AFFECTED_NODE, AFFECTED_NODE_TYPE, IMPACT_DISTANCE, IMPACT_DESCRIPTION, WILL_BREAK, RISK_SCORE, CREATED_BY)
VALUES (
  'demo-analysis-001',
  'HIGH',
  'NODE_DELETE',
  'D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_STG_ORDERS',
  'D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.VW_EXECUTIVE_DASHBOARD',
  'VIEW',
  3,
  'Deleting R_STG_ORDERS will BREAK VW_EXECUTIVE_DASHBOARD (3 hops). Critical executive report.',
  TRUE,
  88
);

INSERT INTO R_IMPACT_ALERTS (ANALYSIS_ID, SEVERITY, ACTION_TYPE, SOURCE_NODE, AFFECTED_NODE, AFFECTED_NODE_TYPE, IMPACT_DISTANCE, IMPACT_DESCRIPTION, WILL_BREAK, RISK_SCORE, CREATED_BY)
VALUES (
  'demo-analysis-001',
  'HIGH',
  'NODE_DELETE',
  'D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_STG_ORDERS',
  'D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.VW_DAILY_KPI_REPORT',
  'VIEW',
  3,
  'Deleting R_STG_ORDERS will BREAK VW_DAILY_KPI_REPORT (3 hops). Daily automated report.',
  TRUE,
  85
);

-- Alert 2: MODERATE - Column rename analysis
INSERT INTO R_IMPACT_ALERTS (ANALYSIS_ID, SEVERITY, ACTION_TYPE, SOURCE_NODE, AFFECTED_NODE, AFFECTED_NODE_TYPE, IMPACT_DISTANCE, IMPACT_DESCRIPTION, WILL_BREAK, RISK_SCORE, CREATED_BY)
VALUES (
  'demo-analysis-002',
  'MODERATE',
  'COLUMN_RENAME',
  'D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_RAW_CUSTOMERS',
  'D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_STG_CUSTOMERS',
  'TABLE',
  1,
  'Renaming CUSTOMER_EMAIL in R_RAW_CUSTOMERS may affect R_STG_CUSTOMERS (references old column name).',
  FALSE,
  55
);

INSERT INTO R_IMPACT_ALERTS (ANALYSIS_ID, SEVERITY, ACTION_TYPE, SOURCE_NODE, AFFECTED_NODE, AFFECTED_NODE_TYPE, IMPACT_DISTANCE, IMPACT_DESCRIPTION, WILL_BREAK, RISK_SCORE, CREATED_BY)
VALUES (
  'demo-analysis-002',
  'MODERATE',
  'COLUMN_RENAME',
  'D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_RAW_CUSTOMERS',
  'D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_MART_CUSTOMER_360',
  'TABLE',
  2,
  'Renaming CUSTOMER_EMAIL in R_RAW_CUSTOMERS may affect R_MART_CUSTOMER_360 (indirect reference).',
  FALSE,
  48
);

INSERT INTO R_IMPACT_ALERTS (ANALYSIS_ID, SEVERITY, ACTION_TYPE, SOURCE_NODE, AFFECTED_NODE, AFFECTED_NODE_TYPE, IMPACT_DISTANCE, IMPACT_DESCRIPTION, WILL_BREAK, RISK_SCORE, CREATED_BY)
VALUES (
  'demo-analysis-002',
  'MODERATE',
  'COLUMN_RENAME',
  'D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_RAW_CUSTOMERS',
  'D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.VW_CUSTOMER_INSIGHTS',
  'VIEW',
  3,
  'Renaming CUSTOMER_EMAIL in R_RAW_CUSTOMERS may affect VW_CUSTOMER_INSIGHTS (3 hops, user-facing view).',
  FALSE,
  52
);

-- Alert 3: WARNING - Adding a column (low risk)
INSERT INTO R_IMPACT_ALERTS (ANALYSIS_ID, SEVERITY, ACTION_TYPE, SOURCE_NODE, AFFECTED_NODE, AFFECTED_NODE_TYPE, IMPACT_DISTANCE, IMPACT_DESCRIPTION, WILL_BREAK, RISK_SCORE, CREATED_BY)
VALUES (
  'demo-analysis-003',
  'WARNING',
  'COLUMN_ADD',
  'D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_FACT_SALES',
  'D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_MART_REVENUE',
  'TABLE',
  1,
  'Adding new column to R_FACT_SALES. No breaking impact on R_MART_REVENUE (additive change).',
  FALSE,
  12
);

-- Alert 4: MODERATE - Source disconnect (already acknowledged)
INSERT INTO R_IMPACT_ALERTS (ANALYSIS_ID, SEVERITY, ACTION_TYPE, SOURCE_NODE, AFFECTED_NODE, AFFECTED_NODE_TYPE, IMPACT_DISTANCE, IMPACT_DESCRIPTION, WILL_BREAK, RISK_SCORE, ACKNOWLEDGED, ACKNOWLEDGED_BY, ACKNOWLEDGED_AT, RESOLUTION_NOTE, CREATED_BY)
VALUES (
  'demo-analysis-004',
  'MODERATE',
  'SOURCE_DISCONNECT',
  'EXT::S3::s3://capgemini-datalake-prod/crm',
  'D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_RAW_CUSTOMERS',
  'TABLE',
  1,
  'S3 bucket connection changed. Backup S3 bucket registered as alternative.',
  FALSE,
  58,
  TRUE,
  'SAJAL_GUPTA',
  DATEADD('hour', -18, CURRENT_TIMESTAMP()),
  'Backup S3 bucket configured at s3://capgemini-datalake-backup/crm. No data loss.',
  CURRENT_USER()
);

-- =============================================================================
-- SECTION 3: Insert Audit Log entries (history demo)
-- =============================================================================

INSERT INTO R_IMPACT_AUDIT_LOG (ANALYSIS_ID, ACTION_TYPE, TARGET_OBJECT, TARGET_COLUMN, TOTAL_AFFECTED, HIGH_COUNT, MODERATE_COUNT, WARNING_COUNT, RISK_SCORE, EXECUTION_TIME_MS, STATUS)
VALUES (
  'demo-analysis-001',
  'NODE_DELETE',
  'D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_STG_ORDERS',
  NULL,
  12,
  3,
  5,
  4,
  85,
  2340,
  'COMPLETED'
);

INSERT INTO R_IMPACT_AUDIT_LOG (ANALYSIS_ID, ACTION_TYPE, TARGET_OBJECT, TARGET_COLUMN, TOTAL_AFFECTED, HIGH_COUNT, MODERATE_COUNT, WARNING_COUNT, RISK_SCORE, EXECUTION_TIME_MS, STATUS)
VALUES (
  'demo-analysis-002',
  'COLUMN_RENAME',
  'D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_RAW_CUSTOMERS',
  'CUSTOMER_EMAIL',
  5,
  0,
  3,
  2,
  52,
  1820,
  'COMPLETED'
);

INSERT INTO R_IMPACT_AUDIT_LOG (ANALYSIS_ID, ACTION_TYPE, TARGET_OBJECT, TARGET_COLUMN, TOTAL_AFFECTED, HIGH_COUNT, MODERATE_COUNT, WARNING_COUNT, RISK_SCORE, EXECUTION_TIME_MS, STATUS)
VALUES (
  'demo-analysis-003',
  'COLUMN_ADD',
  'D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_FACT_SALES',
  'NEW_METRIC_COL',
  1,
  0,
  0,
  1,
  12,
  890,
  'COMPLETED'
);

INSERT INTO R_IMPACT_AUDIT_LOG (ANALYSIS_ID, ACTION_TYPE, TARGET_OBJECT, TARGET_COLUMN, TOTAL_AFFECTED, HIGH_COUNT, MODERATE_COUNT, WARNING_COUNT, RISK_SCORE, EXECUTION_TIME_MS, STATUS)
VALUES (
  'demo-analysis-004',
  'SOURCE_DISCONNECT',
  'EXT::S3::s3://capgemini-datalake-prod/crm',
  NULL,
  3,
  0,
  2,
  1,
  58,
  1250,
  'COMPLETED'
);

-- =============================================================================
-- SECTION 4: Insert Subscription (demo user)
-- =============================================================================

INSERT INTO R_IMPACT_SUBSCRIPTIONS (USER_EMAIL, OBJECT_PATTERN, MIN_SEVERITY, NOTIFY_EMAIL, NOTIFY_IN_APP)
VALUES (
  'sajal.e.gupta@capgemini.com',
  '%EXECUTIVE%',
  'MODERATE',
  TRUE,
  TRUE
);

INSERT INTO R_IMPACT_SUBSCRIPTIONS (USER_EMAIL, OBJECT_PATTERN, MIN_SEVERITY, NOTIFY_EMAIL, NOTIFY_IN_APP)
VALUES (
  'sajal.e.gupta@capgemini.com',
  '%FACT%',
  'HIGH',
  TRUE,
  TRUE
);

-- =============================================================================
-- SECTION 5: Verification Queries
-- =============================================================================

-- Check all rules are inserted
SELECT 'RULES' AS SECTION, COUNT(*) AS COUNT FROM R_IMPACT_RULES WHERE IS_ACTIVE = TRUE;

-- Check all alerts are inserted
SELECT 'ALERTS' AS SECTION, SEVERITY, COUNT(*) AS COUNT
FROM R_IMPACT_ALERTS
GROUP BY SEVERITY
ORDER BY SEVERITY;

-- Check audit log
SELECT 'AUDIT_LOG' AS SECTION, COUNT(*) AS COUNT FROM R_IMPACT_AUDIT_LOG;

-- Check subscriptions
SELECT 'SUBSCRIPTIONS' AS SECTION, COUNT(*) AS COUNT FROM R_IMPACT_SUBSCRIPTIONS WHERE IS_ACTIVE = TRUE;

-- =============================================================================
-- SECTION 6: Demo Test Queries (run these to test the SP)
-- =============================================================================

-- TEST 1: Analyze impact of deleting R_STG_ORDERS
-- CALL GET_IMPACT_ANALYSIS('NODE_DELETE', 'D_IN_CAPG_POC_AI_SCALABILITY', 'AI_SCALABILITY_SCHEMA', 'R_STG_ORDERS', NULL, NULL);

-- TEST 2: Analyze impact of renaming a column
-- CALL GET_IMPACT_ANALYSIS('COLUMN_RENAME', 'D_IN_CAPG_POC_AI_SCALABILITY', 'AI_SCALABILITY_SCHEMA', 'R_RAW_CUSTOMERS', 'CUSTOMER_EMAIL', PARSE_JSON('{"newName": "EMAIL_ADDRESS"}'));

-- TEST 3: Analyze impact of adding a column (should be low risk)
-- CALL GET_IMPACT_ANALYSIS('COLUMN_ADD', 'D_IN_CAPG_POC_AI_SCALABILITY', 'AI_SCALABILITY_SCHEMA', 'R_FACT_SALES', 'NEW_METRIC', NULL);

-- TEST 4: Analyze impact of disconnecting external source
-- CALL GET_IMPACT_ANALYSIS('SOURCE_DISCONNECT', 'D_IN_CAPG_POC_AI_SCALABILITY', 'AI_SCALABILITY_SCHEMA', 'R_RAW_CLICKSTREAM', NULL, NULL);

-- =============================================================================
-- SECTION 7: API Test Endpoints (use from browser/Postman)
-- =============================================================================
/*
  After running this SQL and starting the Node.js server:

  1. GET alerts:
     GET http://localhost:5001/api/impact/alerts
     GET http://localhost:5001/api/impact/alerts?severity=HIGH&acknowledged=false

  2. Run impact analysis:
     POST http://localhost:5001/api/impact/analyze
     Body: {
       "actionType": "NODE_DELETE",
       "targetDatabase": "D_IN_CAPG_POC_AI_SCALABILITY",
       "targetSchema": "AI_SCALABILITY_SCHEMA",
       "targetObject": "R_STG_ORDERS",
       "includeAiSuggestion": true
     }

  3. Acknowledge an alert:
     PUT http://localhost:5001/api/impact/alerts/<ALERT_ID>/ack
     Body: { "resolutionNote": "Created view alias before drop" }

  4. Get analysis history:
     GET http://localhost:5001/api/impact/history

  5. Get rules:
     GET http://localhost:5001/api/impact/rules
*/

SELECT '✅ Test data loaded successfully! Run the CALL statements above to test.' AS STATUS;

show agents;
