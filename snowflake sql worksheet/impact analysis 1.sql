USE ROLE X_IN_CAPG_POC_RWCX_AI_SCALABILITY_SOL;
USE WAREHOUSE W_IN_CAPG_AI_SCALABILITY_SOL_XS;
USE DATABASE D_IN_CAPG_POC_AI_SCALABILITY;
USE SCHEMA AI_SCALABILITY_SCHEMA;




-- =============================================================================
-- IMPACT ANALYSIS & ALERT LOADER — DATABASE SETUP
-- =============================================================================
-- Run this script in Snowsight with the role: X_IN_CAPG_POC_RWCX_AI_SCALABILITY_SOL
-- Database: D_IN_CAPG_POC_AI_SCALABILITY
-- Schema: AI_SCALABILITY_SCHEMA
-- =============================================================================

USE DATABASE D_IN_CAPG_POC_AI_SCALABILITY;
USE SCHEMA AI_SCALABILITY_SCHEMA;

-- =============================================================================
-- TABLE 1: R_IMPACT_ALERTS
-- Stores all generated impact alerts with severity classification
-- =============================================================================
CREATE TABLE IF NOT EXISTS R_IMPACT_ALERTS (
    ALERT_ID          VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
    ANALYSIS_ID       VARCHAR(36),
    TIMESTAMP         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    SEVERITY          VARCHAR(10) NOT NULL,          -- 'HIGH', 'MODERATE', 'WARNING'
    ACTION_TYPE       VARCHAR(30) NOT NULL,          -- 'NODE_DELETE', 'COLUMN_RENAME', etc.
    SOURCE_NODE       VARCHAR(500) NOT NULL,         -- FQN of the changed object
    AFFECTED_NODE     VARCHAR(500) NOT NULL,         -- FQN of the impacted object
    AFFECTED_NODE_TYPE VARCHAR(30),                  -- 'TABLE', 'VIEW', 'STAGE', 'EXTERNAL'
    IMPACT_DISTANCE   INTEGER,                       -- Hops from source to affected
    IMPACT_DESCRIPTION VARCHAR(2000),
    WILL_BREAK        BOOLEAN DEFAULT FALSE,
    AFFECTED_COLUMNS  VARIANT,                       -- Array of column names
    SUGGESTION        VARCHAR(2000),
    RISK_SCORE        INTEGER,                       -- 0-100
    ACKNOWLEDGED      BOOLEAN DEFAULT FALSE,
    ACKNOWLEDGED_BY   VARCHAR(200),
    ACKNOWLEDGED_AT   TIMESTAMP_NTZ,
    RESOLUTION_NOTE   VARCHAR(2000),
    AUTO_DISMISSED    BOOLEAN DEFAULT FALSE,
    CREATED_BY        VARCHAR(200) DEFAULT CURRENT_USER(),
    PRIMARY KEY (ALERT_ID)
);

-- =============================================================================
-- TABLE 2: R_IMPACT_AUDIT_LOG
-- Records every impact analysis request for compliance and history
-- =============================================================================
CREATE TABLE IF NOT EXISTS R_IMPACT_AUDIT_LOG (
    AUDIT_ID          VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
    ANALYSIS_ID       VARCHAR(36) NOT NULL,
    TIMESTAMP         TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    REQUESTED_BY      VARCHAR(200) DEFAULT CURRENT_USER(),
    ACTION_TYPE       VARCHAR(30) NOT NULL,
    TARGET_OBJECT     VARCHAR(500) NOT NULL,
    TARGET_COLUMN     VARCHAR(200),
    PARAMETERS        VARIANT,
    TOTAL_AFFECTED    INTEGER DEFAULT 0,
    HIGH_COUNT        INTEGER DEFAULT 0,
    MODERATE_COUNT    INTEGER DEFAULT 0,
    WARNING_COUNT     INTEGER DEFAULT 0,
    RISK_SCORE        INTEGER DEFAULT 0,
    AI_SUGGESTION     VARCHAR(4000),
    EXECUTION_TIME_MS INTEGER,
    STATUS            VARCHAR(20) DEFAULT 'COMPLETED',  -- 'COMPLETED', 'FAILED', 'TIMEOUT'
    ERROR_MESSAGE     VARCHAR(2000),
    PRIMARY KEY (AUDIT_ID)
);

-- =============================================================================
-- TABLE 3: R_IMPACT_RULES
-- User-configurable severity rules for impact scoring
-- =============================================================================
CREATE TABLE IF NOT EXISTS R_IMPACT_RULES (
    RULE_ID           VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
    RULE_NAME         VARCHAR(200) NOT NULL,
    RULE_DESCRIPTION  VARCHAR(1000),
    CONDITION_TYPE    VARCHAR(50) NOT NULL,     -- 'NODE_PATTERN', 'DOWNSTREAM_COUNT', 'CRITICAL_PATH', 'OBJECT_TYPE', 'EXTERNAL_SOURCE'
    CONDITION_VALUE   VARIANT NOT NULL,         -- JSON with rule parameters
    SEVERITY_OVERRIDE VARCHAR(10),              -- Force severity to this level (optional)
    SEVERITY_MODIFIER INTEGER DEFAULT 0,        -- Add/subtract from calculated score
    IS_ACTIVE         BOOLEAN DEFAULT TRUE,
    CREATED_BY        VARCHAR(200) DEFAULT CURRENT_USER(),
    CREATED_AT        TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (RULE_ID)
);

-- =============================================================================
-- TABLE 4: R_IMPACT_SUBSCRIPTIONS
-- Alert notification preferences per user
-- =============================================================================
CREATE TABLE IF NOT EXISTS R_IMPACT_SUBSCRIPTIONS (
    SUBSCRIPTION_ID   VARCHAR(36) DEFAULT UUID_STRING() NOT NULL,
    USER_EMAIL        VARCHAR(300) NOT NULL,
    OBJECT_PATTERN    VARCHAR(500),              -- FQN pattern (supports % wildcards)
    MIN_SEVERITY      VARCHAR(10) DEFAULT 'WARNING',  -- Minimum severity to notify
    NOTIFY_EMAIL      BOOLEAN DEFAULT TRUE,
    NOTIFY_IN_APP     BOOLEAN DEFAULT TRUE,
    IS_ACTIVE         BOOLEAN DEFAULT TRUE,
    CREATED_AT        TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
    PRIMARY KEY (SUBSCRIPTION_ID)
);

-- =============================================================================
-- STORED PROCEDURE: GET_IMPACT_ANALYSIS
-- Core impact analysis engine
-- Input: ACTION_TYPE, TARGET_DB, TARGET_SCHEMA, TARGET_OBJECT, TARGET_COLUMN, PARAMETERS
-- Output: VARIANT with impacts[], alerts[], riskScore, summary{}
-- =============================================================================
CREATE OR REPLACE PROCEDURE GET_IMPACT_ANALYSIS(
    P_ACTION_TYPE VARCHAR,
    P_TARGET_DB VARCHAR,
    P_TARGET_SCHEMA VARCHAR,
    P_TARGET_OBJECT VARCHAR,
    P_TARGET_COLUMN VARCHAR,
    P_PARAMETERS VARIANT
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
try {
    var uuidStmt = snowflake.execute({sqlText: "SELECT UUID_STRING()"});
    uuidStmt.next();
    var analysisId = uuidStmt.getColumnValue(1);

    var startTime = Date.now();
    var targetFqn = P_TARGET_DB + "." + P_TARGET_SCHEMA + "." + P_TARGET_OBJECT;

    // =========================================================================
    // STEP 1: Get downstream lineage from target node
    // =========================================================================
    var lineageSql = `
        SELECT *
        FROM TABLE(SNOWFLAKE.CORE.GET_LINEAGE(
            '${targetFqn}',
            'TABLE',
            'DOWNSTREAM',
            10
        ))
    `;

    var downstreamNodes = [];
    try {
        var lineageStmt = snowflake.execute({sqlText: lineageSql});
        while (lineageStmt.next()) {
            var targetDb = lineageStmt.getColumnValue("TARGET_OBJECT_DATABASE");
            var targetSchema = lineageStmt.getColumnValue("TARGET_OBJECT_SCHEMA");
            var targetName = lineageStmt.getColumnValue("TARGET_OBJECT_NAME");
            var targetDomain = lineageStmt.getColumnValue("TARGET_OBJECT_DOMAIN");
            var distance = lineageStmt.getColumnValue("DISTANCE");

            var nodeFqn = targetDb + "." + targetSchema + "." + targetName;

            // Avoid duplicates
            var exists = false;
            for (var i = 0; i < downstreamNodes.length; i++) {
                if (downstreamNodes[i].fqn === nodeFqn) { exists = true; break; }
            }
            if (!exists && nodeFqn !== targetFqn) {
                downstreamNodes.push({
                    fqn: nodeFqn,
                    database: targetDb,
                    schema: targetSchema,
                    name: targetName,
                    domain: targetDomain || "TABLE",
                    distance: distance || 1
                });
            }
        }
    } catch (lineageErr) {
        // GET_LINEAGE may fail for objects without lineage
    }

    // =========================================================================
    // STEP 2: Check external sources that target any downstream node
    // =========================================================================
    var allNodeFqns = [targetFqn];
    for (var i = 0; i < downstreamNodes.length; i++) {
        allNodeFqns.push(downstreamNodes[i].fqn);
    }

    var extNodes = [];
    try {
        var extSql = `
            SELECT SOURCE_TYPE, SOURCE_NAMESPACE, SOURCE_NAME,
                   TARGET_DATABASE, TARGET_SCHEMA, TARGET_TABLE
            FROM R_EXTERNAL_LINEAGE_SOURCES
            WHERE IS_ACTIVE = TRUE
              AND (TARGET_DATABASE || '.' || TARGET_SCHEMA || '.' || TARGET_TABLE)
              IN ('${allNodeFqns.join("','")}')
        `;
        var extStmt = snowflake.execute({sqlText: extSql});
        while (extStmt.next()) {
            extNodes.push({
                fqn: "EXT::" + extStmt.getColumnValue("SOURCE_TYPE") + "::" + extStmt.getColumnValue("SOURCE_NAMESPACE") + "/" + extStmt.getColumnValue("SOURCE_NAME"),
                domain: "EXTERNAL",
                sourceType: extStmt.getColumnValue("SOURCE_TYPE"),
                distance: -1
            });
        }
    } catch (extErr) { /* non-fatal */ }

    // =========================================================================
    // STEP 3: Get downstream count for each node (importance scoring)
    // =========================================================================
    var nodeDownstreamCounts = {};
    for (var i = 0; i < downstreamNodes.length; i++) {
        var node = downstreamNodes[i];
        var countSql = `
            SELECT COUNT(DISTINCT TARGET_OBJECT_NAME) as CNT
            FROM TABLE(SNOWFLAKE.CORE.GET_LINEAGE('${node.fqn}', 'TABLE', 'DOWNSTREAM', 3))
        `;
        try {
            var countStmt = snowflake.execute({sqlText: countSql});
            countStmt.next();
            nodeDownstreamCounts[node.fqn] = countStmt.getColumnValue("CNT") || 0;
        } catch (e) {
            nodeDownstreamCounts[node.fqn] = 0;
        }
    }

    // =========================================================================
    // STEP 4: Fetch custom rules
    // =========================================================================
    var rules = [];
    try {
        var ruleStmt = snowflake.execute({sqlText: "SELECT * FROM R_IMPACT_RULES WHERE IS_ACTIVE = TRUE"});
        while (ruleStmt.next()) {
            rules.push({
                conditionType: ruleStmt.getColumnValue("CONDITION_TYPE"),
                conditionValue: JSON.parse(ruleStmt.getColumnValue("CONDITION_VALUE")),
                severityOverride: ruleStmt.getColumnValue("SEVERITY_OVERRIDE"),
                severityModifier: ruleStmt.getColumnValue("SEVERITY_MODIFIER") || 0
            });
        }
    } catch (e) { /* no rules */ }

    // =========================================================================
    // STEP 5: Score each downstream node
    // =========================================================================
    var actionMultipliers = {
        'NODE_DELETE': 1.5,
        'COLUMN_DELETE': 1.4,
        'TYPE_CHANGE': 1.3,
        'COLUMN_RENAME': 1.2,
        'DEPENDENCY_CHANGE': 1.1,
        'SCHEMA_MOVE': 1.1,
        'SOURCE_DISCONNECT': 1.4,
        'COLUMN_ADD': 0.5,
        'NODE_ADD': 0.3
    };

    var impacts = [];
    for (var i = 0; i < downstreamNodes.length; i++) {
        var node = downstreamNodes[i];
        var score = 0;

        // Distance factor
        if (node.distance === 1) score += 40;
        else if (node.distance === 2) score += 25;
        else if (node.distance <= 4) score += 15;
        else score += 5;

        // Importance factor (downstream count)
        var dCount = nodeDownstreamCounts[node.fqn] || 0;
        if (dCount > 10) score += 30;
        else if (dCount > 5) score += 20;
        else if (dCount > 0) score += 10;

        // Action multiplier
        var multiplier = actionMultipliers[P_ACTION_TYPE] || 1.0;
        score = Math.round(score * multiplier);

        // Node type bonus
        if (node.name && (node.name.indexOf("EXECUTIVE") >= 0 || node.name.indexOf("DASHBOARD") >= 0)) {
            score += 20;
        }
        if (node.name && node.name.indexOf("VW_") === 0) {
            score += 5; // Views slightly more important (user-facing)
        }

        // Apply custom rules
        for (var r = 0; r < rules.length; r++) {
            var rule = rules[r];
            if (rule.conditionType === "NODE_PATTERN" && node.fqn.indexOf(rule.conditionValue.pattern) >= 0) {
                if (rule.severityOverride) { score = rule.severityOverride === "HIGH" ? 80 : rule.severityOverride === "MODERATE" ? 50 : 20; }
                score += rule.severityModifier;
            }
            if (rule.conditionType === "DOWNSTREAM_COUNT" && dCount >= (rule.conditionValue.threshold || 5)) {
                score += rule.severityModifier;
            }
        }

        // Cap at 100
        score = Math.min(score, 100);

        // Classify
        var severity = "WARNING";
        if (score >= 70) severity = "HIGH";
        else if (score >= 40) severity = "MODERATE";

        // Will it break?
        var willBreak = false;
        if (P_ACTION_TYPE === "NODE_DELETE" && node.distance === 1) willBreak = true;
        if (P_ACTION_TYPE === "COLUMN_DELETE" && node.distance <= 2) willBreak = true;
        if (P_ACTION_TYPE === "SOURCE_DISCONNECT") willBreak = true;

        impacts.push({
            node: node.fqn,
            nodeType: node.domain,
            database: node.database,
            schema: node.schema,
            name: node.name,
            distance: node.distance,
            severity: severity,
            riskScore: score,
            willBreak: willBreak,
            downstreamCount: dCount,
            description: generateDescription(P_ACTION_TYPE, targetFqn, node, willBreak)
        });
    }

    // =========================================================================
    // STEP 6: Calculate overall risk score
    // =========================================================================
    var highCount = 0, modCount = 0, warnCount = 0;
    var maxScore = 0;
    for (var i = 0; i < impacts.length; i++) {
        if (impacts[i].severity === "HIGH") highCount++;
        else if (impacts[i].severity === "MODERATE") modCount++;
        else warnCount++;
        if (impacts[i].riskScore > maxScore) maxScore = impacts[i].riskScore;
    }

    // Overall risk = weighted average biased toward max
    var avgScore = impacts.length > 0 ? impacts.reduce(function(s, im) { return s + im.riskScore; }, 0) / impacts.length : 0;
    var overallRisk = Math.round(maxScore * 0.6 + avgScore * 0.4);

    // =========================================================================
    // STEP 7: Insert alerts into R_IMPACT_ALERTS
    // =========================================================================
    for (var i = 0; i < impacts.length; i++) {
        var imp = impacts[i];
        var insertSql = `
            INSERT INTO R_IMPACT_ALERTS (ANALYSIS_ID, SEVERITY, ACTION_TYPE, SOURCE_NODE, AFFECTED_NODE, AFFECTED_NODE_TYPE, IMPACT_DISTANCE, IMPACT_DESCRIPTION, WILL_BREAK, RISK_SCORE)
            VALUES ('${analysisId}', '${imp.severity}', '${P_ACTION_TYPE}', '${targetFqn}', '${imp.node}', '${imp.nodeType}', ${imp.distance}, '${(imp.description || "").replace(/'/g, "''")}', ${imp.willBreak}, ${imp.riskScore})
        `;
        try { snowflake.execute({sqlText: insertSql}); } catch (e) { /* continue */ }
    }

    // =========================================================================
    // STEP 8: Insert audit log
    // =========================================================================
    var executionTime = Date.now() - startTime;
    var auditSql = `
        INSERT INTO R_IMPACT_AUDIT_LOG (ANALYSIS_ID, ACTION_TYPE, TARGET_OBJECT, TARGET_COLUMN, PARAMETERS, TOTAL_AFFECTED, HIGH_COUNT, MODERATE_COUNT, WARNING_COUNT, RISK_SCORE, EXECUTION_TIME_MS, STATUS)
        VALUES ('${analysisId}', '${P_ACTION_TYPE}', '${targetFqn}', ${P_TARGET_COLUMN ? "'" + P_TARGET_COLUMN + "'" : "NULL"}, PARSE_JSON('${JSON.stringify(P_PARAMETERS || {}).replace(/'/g, "''")}'), ${impacts.length}, ${highCount}, ${modCount}, ${warnCount}, ${overallRisk}, ${executionTime}, 'COMPLETED')
    `;
    try { snowflake.execute({sqlText: auditSql}); } catch (e) { /* continue */ }

    // =========================================================================
    // RETURN RESULTS
    // =========================================================================
    return {
        analysisId: analysisId,
        targetObject: targetFqn,
        actionType: P_ACTION_TYPE,
        riskScore: overallRisk,
        totalAffected: impacts.length,
        summary: { high: highCount, moderate: modCount, warning: warnCount },
        impacts: impacts,
        externalSourcesInvolved: extNodes.length,
        executionTimeMs: executionTime
    };

} catch (globalErr) {
    return { error: true, message: globalErr.message, stack: globalErr.stack };
}

// =========================================================================
// HELPER: Generate human-readable impact description
// =========================================================================
function generateDescription(actionType, sourceFqn, node, willBreak) {
    var verb = willBreak ? "will BREAK" : "may be affected";
    var sourceName = sourceFqn.split(".").pop();
    var actionDesc = {
        'NODE_DELETE': 'Deleting ' + sourceName,
        'COLUMN_DELETE': 'Dropping column from ' + sourceName,
        'COLUMN_RENAME': 'Renaming column in ' + sourceName,
        'TYPE_CHANGE': 'Changing column type in ' + sourceName,
        'DEPENDENCY_CHANGE': 'Changing dependency of ' + sourceName,
        'NODE_ADD': 'Adding new object near ' + sourceName,
        'COLUMN_ADD': 'Adding column to ' + sourceName,
        'SOURCE_DISCONNECT': 'Disconnecting source from ' + sourceName,
        'SCHEMA_MOVE': 'Moving ' + sourceName + ' to different schema'
    };
    var desc = (actionDesc[actionType] || actionType) + " " + verb + " " + node.name;
    desc += " (" + node.distance + " hop" + (node.distance > 1 ? "s" : "") + " downstream)";
    if (node.domain === "VIEW" || (node.name && node.name.indexOf("VW_") === 0)) {
        desc += ". This is a VIEW (likely user-facing).";
    }
    return desc;
}
$$;


-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE R_IMPACT_ALERTS TO ROLE X_IN_CAPG_POC_RWCX_AI_SCALABILITY_SOL;
GRANT SELECT, INSERT ON TABLE R_IMPACT_AUDIT_LOG TO ROLE X_IN_CAPG_POC_RWCX_AI_SCALABILITY_SOL;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE R_IMPACT_RULES TO ROLE X_IN_CAPG_POC_RWCX_AI_SCALABILITY_SOL;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE R_IMPACT_SUBSCRIPTIONS TO ROLE X_IN_CAPG_POC_RWCX_AI_SCALABILITY_SOL;
GRANT USAGE ON PROCEDURE GET_IMPACT_ANALYSIS(VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARIANT) TO ROLE X_IN_CAPG_POC_RWCX_AI_SCALABILITY_SOL;

-- =============================================================================
-- VERIFY
-- =============================================================================
SHOW TABLES LIKE 'R_IMPACT%';
SHOW PROCEDURES LIKE 'GET_IMPACT_ANALYSIS';

SELECT 'Impact Analysis tables and SP created successfully!' AS STATUS;
