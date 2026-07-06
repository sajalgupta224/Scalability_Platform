USE ROLE X_IN_CAPG_POC_RWCX_AI_SCALABILITY_SOL;
USE WAREHOUSE W_IN_CAPG_AI_SCALABILITY_SOL_XS;
USE DATABASE D_IN_CAPG_POC_AI_SCALABILITY;
USE SCHEMA AI_SCALABILITY_SCHEMA;

-- =============================================================================
-- RAISE Platform — Impact Analysis: Scheduled DDL Execution
-- Run in Snowsight under D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA
-- =============================================================================

USE DATABASE D_IN_CAPG_POC_AI_SCALABILITY;
USE SCHEMA AI_SCALABILITY_SCHEMA;

-- =============================================================================
-- 1. Scheduled DDL Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS R_IMPACT_SCHEDULED_DDL (
    ID VARCHAR(36) DEFAULT UUID_STRING(),
    DDL_STATEMENTS VARIANT NOT NULL,
    SCHEDULED_AT TIMESTAMP_NTZ NOT NULL,
    STATUS VARCHAR(20) DEFAULT 'PENDING',  -- PENDING, EXECUTED, FAILED, CANCELLED
    CREATED_BY VARCHAR(200),
    CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    EXECUTED_AT TIMESTAMP_NTZ,
    ANALYSIS_ID VARCHAR(36),
    ACTION_TYPE VARCHAR(50),
    TARGET_OBJECT VARCHAR(500),
    ERROR_MESSAGE VARCHAR(4000),
    CONSTRAINT pk_scheduled_ddl PRIMARY KEY (ID)
);

COMMENT ON TABLE R_IMPACT_SCHEDULED_DDL IS 'Stores DDL statements scheduled for future execution via Impact Analysis';

-- =============================================================================
-- 2. Stored Procedure: Execute Due DDL Schedules
-- =============================================================================
CREATE OR REPLACE PROCEDURE EXECUTE_DUE_DDL_SCHEDULES()
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
var results = [];

// Find all PENDING schedules that are due
var findStmt = snowflake.execute({
    sqlText: `SELECT ID, DDL_STATEMENTS, ANALYSIS_ID, ACTION_TYPE, TARGET_OBJECT
              FROM R_IMPACT_SCHEDULED_DDL
              WHERE STATUS = 'PENDING' AND SCHEDULED_AT <= CURRENT_TIMESTAMP()
              ORDER BY SCHEDULED_AT ASC
              LIMIT 20`
});

while (findStmt.next()) {
    var schedId = findStmt.getColumnValue('ID');
    var ddlArray = findStmt.getColumnValue('DDL_STATEMENTS');
    var analysisId = findStmt.getColumnValue('ANALYSIS_ID');
    var actionType = findStmt.getColumnValue('ACTION_TYPE');
    var targetObject = findStmt.getColumnValue('TARGET_OBJECT');
    
    var schedResult = { id: schedId, statements: [], allSuccess: true };
    
    try {
        // DDL_STATEMENTS is a VARIANT array — iterate and execute each
        if (Array.isArray(ddlArray)) {
            for (var i = 0; i < ddlArray.length; i++) {
                var stmt = ddlArray[i];
                // Skip comments
                if (stmt.trim().startsWith('--')) continue;
                
                try {
                    snowflake.execute({ sqlText: stmt });
                    schedResult.statements.push({ sql: stmt, status: 'SUCCESS' });
                } catch (stmtErr) {
                    schedResult.statements.push({ sql: stmt, status: 'FAILED', error: stmtErr.message });
                    schedResult.allSuccess = false;
                }
            }
        }
        
        // Mark as EXECUTED or FAILED
        var finalStatus = schedResult.allSuccess ? 'EXECUTED' : 'FAILED';
        var errorMsg = schedResult.allSuccess ? null : JSON.stringify(schedResult.statements.filter(function(s){return s.status==='FAILED';}));
        
        snowflake.execute({
            sqlText: `UPDATE R_IMPACT_SCHEDULED_DDL 
                      SET STATUS = '` + finalStatus + `', 
                          EXECUTED_AT = CURRENT_TIMESTAMP(),
                          ERROR_MESSAGE = '` + (errorMsg || '').replace(/'/g, "''") + `'
                      WHERE ID = '` + schedId + `'`
        });
        
        // If successful and has an analysis_id, mark alerts as EXECUTED
        if (schedResult.allSuccess && analysisId) {
            try {
                snowflake.execute({
                    sqlText: `UPDATE R_IMPACT_ALERTS 
                              SET STATUS = 'EXECUTED', EXECUTED_BY = 'SCHEDULED_TASK', EXECUTED_AT = CURRENT_TIMESTAMP()
                              WHERE ANALYSIS_ID = '` + analysisId + `'`
                });
            } catch (e) { /* non-fatal */ }
        }
        
        // Log to audit
        try {
            snowflake.execute({
                sqlText: `INSERT INTO R_IMPACT_AUDIT_LOG (ANALYSIS_ID, ACTION_TYPE, TARGET_OBJECT, STATUS, PARAMETERS) 
                          SELECT '` + (analysisId || 'scheduled') + `', '` + (actionType || 'SCHEDULED_DDL') + `', '` + (targetObject || 'unknown') + `', '` + finalStatus + `', PARSE_JSON('` + JSON.stringify({scheduled_id: schedId, results: schedResult.statements}).replace(/'/g, "''") + `')`
            });
        } catch (e) { /* non-fatal */ }
        
    } catch (outerErr) {
        // Mark schedule as FAILED
        snowflake.execute({
            sqlText: `UPDATE R_IMPACT_SCHEDULED_DDL 
                      SET STATUS = 'FAILED', ERROR_MESSAGE = '` + outerErr.message.replace(/'/g, "''") + `'
                      WHERE ID = '` + schedId + `'`
        });
        schedResult.allSuccess = false;
        schedResult.error = outerErr.message;
    }
    
    results.push(schedResult);
}

return { processed: results.length, results: results };
$$;

-- =============================================================================
-- 3. Snowflake TASK — Runs every 5 minutes to check for due schedules
-- =============================================================================
CREATE OR REPLACE TASK EXECUTE_SCHEDULED_DDL_TASK
  WAREHOUSE = 'W_IN_CAPG_AI_SCALABILITY_SOL_XS'
  SCHEDULE = '5 MINUTE'
  COMMENT = 'Checks for pending scheduled DDL and executes when due'
AS
  CALL EXECUTE_DUE_DDL_SCHEDULES();

-- =============================================================================
-- 4. Resume the task (tasks are created in SUSPENDED state)
-- =============================================================================
-- Uncomment the line below to activate the task:
-- ALTER TASK EXECUTE_SCHEDULED_DDL_TASK RESUME;

-- To check task status:
-- SHOW TASKS LIKE 'EXECUTE_SCHEDULED_DDL%';

-- To see task history:
-- SELECT * FROM TABLE(INFORMATION_SCHEMA.TASK_HISTORY()) WHERE NAME = 'EXECUTE_SCHEDULED_DDL_TASK' ORDER BY SCHEDULED_TIME DESC;

-- =============================================================================
-- 5. Test: Insert a sample scheduled DDL (optional)
-- =============================================================================
-- INSERT INTO R_IMPACT_SCHEDULED_DDL (ID, DDL_STATEMENTS, SCHEDULED_AT, STATUS, CREATED_BY, ANALYSIS_ID, ACTION_TYPE, TARGET_OBJECT)
-- SELECT UUID_STRING(), PARSE_JSON('["SELECT 1 AS TEST_SCHEDULED_EXECUTION"]'), DATEADD(MINUTE, 2, CURRENT_TIMESTAMP()), 'PENDING', CURRENT_USER(), NULL, 'TEST', 'TEST_OBJECT';

-- Verify:
-- SELECT * FROM R_IMPACT_SCHEDULED_DDL ORDER BY CREATED_AT DESC;





--------------------------
--------------------------
ALTER TASK EXECUTE_SCHEDULED_DDL_TASK RESUME;

SHOW TASKS LIKE 'EXECUTE_SCHEDULED_DDL%';



SELECT * FROM R_IMPACT_SCHEDULED_DDL ORDER BY CREATED_AT DESC;
