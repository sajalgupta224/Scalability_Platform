USE ROLE X_IN_CAPG_POC_RWCX_AI_SCALABILITY_SOL;
USE WAREHOUSE W_IN_CAPG_AI_SCALABILITY_SOL_XS;
USE DATABASE D_IN_CAPG_POC_AI_SCALABILITY;
USE SCHEMA AI_SCALABILITY_SCHEMA;


-- =============================================================================
-- ADD STATUS TRACKING TO R_IMPACT_ALERTS
-- =============================================================================
-- Run this in Snowsight to add change confirmation columns
-- =============================================================================

USE DATABASE D_IN_CAPG_POC_AI_SCALABILITY;
USE SCHEMA AI_SCALABILITY_SCHEMA;

-- Add STATUS column: PLANNED (analysis done) vs EXECUTED (change confirmed)
ALTER TABLE R_IMPACT_ALERTS ADD COLUMN IF NOT EXISTS STATUS VARCHAR(20) DEFAULT 'PLANNED';

-- Add execution tracking columns
ALTER TABLE R_IMPACT_ALERTS ADD COLUMN IF NOT EXISTS EXECUTED_BY VARCHAR(200);
ALTER TABLE R_IMPACT_ALERTS ADD COLUMN IF NOT EXISTS EXECUTED_AT TIMESTAMP_NTZ;

-- Update existing alerts to PLANNED status
UPDATE R_IMPACT_ALERTS SET STATUS = 'PLANNED' WHERE STATUS IS NULL;

-- Verify
SELECT STATUS, COUNT(*) AS CNT FROM R_IMPACT_ALERTS GROUP BY STATUS;

SELECT 'STATUS columns added successfully!' AS RESULT;
