USE WAREHOUSE W_IN_CAPG_AI_SCALABILITY_SOL_XS;
USE DATABASE D_IN_CAPG_POC_AI_SCALABILITY;
USE SCHEMA AI_SCALABILITY_SCHEMA;
USE ROLE X_IN_CAPG_POC_RWCX_AI_SCALABILITY_SOL;



-- ============================================================
-- STEP 1: Updated GET_FULL_LINEAGE_JSON with domain info + STAGE support
-- Run this in Snowsight against your database
-- ============================================================

CREATE OR REPLACE PROCEDURE D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.GET_FULL_LINEAGE_JSON(
  DB_NAME STRING,
  SCHEMA_NAME STRING,
  OBJECT_NAME STRING,
  OBJECT_TYPE STRING,
  COLUMN_NAME STRING,
  INCLUDE_COLUMNS BOOLEAN,
  DIRECTION STRING,
  MAX_DISTANCE STRING
)
RETURNS VARIANT
LANGUAGE JAVASCRIPT
EXECUTE AS CALLER
AS
$$
const columnName = COLUMN_NAME;

function run(sql) {
  return snowflake.createStatement({ sqlText: sql }).execute();
}

function normalizeObjectType(t) {
  if (!t) return 'TABLE';
  t = t.toUpperCase();
  // NEW: Added STAGE support for S3/Azure/GCS lineage
  if (['TABLE','VIEW','DYNAMIC_TABLE','COLUMN','STAGE'].includes(t)) return t;
  return 'TABLE';
}

function objectId(db, schema, name) {
  return db + '.' + schema + '.' + name;
}

// NEW: Derive domain from GET_LINEAGE output or name heuristics
function deriveDomain(domain, name) {
  if (domain) return domain.toUpperCase();
  if (!name) return 'TABLE';
  var upper = name.toUpperCase();
  if (upper.startsWith('V_') || upper.startsWith('VW_')) return 'VIEW';
  if (upper.startsWith('DT_')) return 'DYNAMIC_TABLE';
  return 'TABLE';
}

var SAFE_OBJECT_TYPE = normalizeObjectType(OBJECT_TYPE);
var DIR = (DIRECTION || 'UPSTREAM').toUpperCase();
var maxDepth = parseInt(MAX_DISTANCE, 10);
if (isNaN(maxDepth) || maxDepth < 1) maxDepth = 3;
var rootObjectFQN = objectId(DB_NAME, SCHEMA_NAME, OBJECT_NAME);
let rootColumnFQN = rootObjectFQN + '.' + columnName;

if (SAFE_OBJECT_TYPE === 'COLUMN') {
  if (!COLUMN_NAME) {
    return { error: 'COLUMN_NAME is required when OBJECT_TYPE = COLUMN' };
  }
  rootColumnFQN = rootObjectFQN + '.' + COLUMN_NAME;
}

/* ===================== OBJECT LINEAGE (BFS) ===================== */

var objectNodes = {};
var objectEdges = [];
var debug = [];

if (SAFE_OBJECT_TYPE !== 'COLUMN') {
  var rawEdges = [];

  // NEW: Now selecting SOURCE_OBJECT_DOMAIN and TARGET_OBJECT_DOMAIN
  var objSql =
    "SELECT SOURCE_OBJECT_DATABASE, SOURCE_OBJECT_SCHEMA, SOURCE_OBJECT_NAME, SOURCE_OBJECT_DOMAIN, " +
    "TARGET_OBJECT_DATABASE, TARGET_OBJECT_SCHEMA, TARGET_OBJECT_NAME, TARGET_OBJECT_DOMAIN, DISTANCE " +
    "FROM TABLE(SNOWFLAKE.CORE.GET_LINEAGE('" +
    rootObjectFQN + "','" + SAFE_OBJECT_TYPE + "','" + DIR + "'))";

  debug.push("Object lineage SQL: " + objSql);
  var rs = run(objSql);

  while (rs.next()) {
    var srcDb = rs.getColumnValue(1);
    var srcSchema = rs.getColumnValue(2);
    var srcName = rs.getColumnValue(3);
    var srcDomain = rs.getColumnValue(4);
    var tgtDb = rs.getColumnValue(5);
    var tgtSchema = rs.getColumnValue(6);
    var tgtName = rs.getColumnValue(7);
    var tgtDomain = rs.getColumnValue(8);

    var srcId = objectId(srcDb, srcSchema, srcName);
    var tgtId = objectId(tgtDb, tgtSchema, tgtName);

    // NEW: Node now includes domain, database, schema, name fields
    if (!objectNodes[srcId]) {
      objectNodes[srcId] = {
        id: srcId,
        type: deriveDomain(srcDomain, srcName).toLowerCase(),
        domain: deriveDomain(srcDomain, srcName),
        database: srcDb,
        schema: srcSchema,
        name: srcName,
        distance: null
      };
    }

    if (!objectNodes[tgtId]) {
      objectNodes[tgtId] = {
        id: tgtId,
        type: deriveDomain(tgtDomain, tgtName).toLowerCase(),
        domain: deriveDomain(tgtDomain, tgtName),
        database: tgtDb,
        schema: tgtSchema,
        name: tgtName,
        distance: null
      };
    }

    rawEdges.push({ source: srcId, target: tgtId });
  }

  /* ---- BFS ---- */
  var queue = [{ id: rootObjectFQN, dist: 0 }];
  var visited = {};
  visited[rootObjectFQN] = 0;

  if (!objectNodes[rootObjectFQN]) {
    objectNodes[rootObjectFQN] = {
      id: rootObjectFQN,
      type: SAFE_OBJECT_TYPE.toLowerCase(),
      domain: SAFE_OBJECT_TYPE,
      database: DB_NAME,
      schema: SCHEMA_NAME,
      name: OBJECT_NAME,
      distance: 0
    };
  }

  while (queue.length > 0) {
    var cur = queue.shift();
    if (cur.dist >= maxDepth) continue;
    rawEdges.forEach(function(e) {
      var next = null;
      if (DIR === 'UPSTREAM' && e.target === cur.id) next = e.source;
      if (DIR === 'DOWNSTREAM' && e.source === cur.id) next = e.target;
      if (next && visited[next] === undefined) {
        visited[next] = cur.dist + 1;
        queue.push({ id: next, dist: cur.dist + 1 });
      }
    });
  }

  Object.keys(visited).forEach(function(id) {
    if (objectNodes[id]) { objectNodes[id].distance = visited[id]; }
  });

  var filteredNodes = {};
  Object.keys(visited).forEach(function(id) {
    if (objectNodes[id]) { filteredNodes[id] = objectNodes[id]; }
  });
  objectNodes = filteredNodes;

  rawEdges.forEach(function(e) {
    if (visited[e.source] !== undefined && visited[e.target] !== undefined) {
      objectEdges.push({
        id: e.source + '->' + e.target,
        source: e.source,
        target: e.target,
        type: 'object'
      });
    }
  });

  debug.push("Object nodes: " + Object.keys(objectNodes).length);
  debug.push("Object edges: " + objectEdges.length);
}

/* ===================== COLUMN LINEAGE ===================== */

var columnNodes = {};
var columnEdges = {};

if (INCLUDE_COLUMNS) {
  debug.push("Column lineage enabled");
  let columnSql = "SELECT SOURCE_OBJECT_DATABASE,SOURCE_OBJECT_SCHEMA,SOURCE_OBJECT_NAME,SOURCE_COLUMN_NAME," +
                  "TARGET_OBJECT_DATABASE,TARGET_OBJECT_SCHEMA,TARGET_OBJECT_NAME,TARGET_COLUMN_NAME" +
                  " FROM TABLE(SNOWFLAKE.CORE.GET_LINEAGE('" + rootColumnFQN + "','COLUMN','" + DIR + "'))";
  debug.push("Executing SQL: " + columnSql);
  var rs2 = run(columnSql);
  var colRawEdges = [];
  while (rs2.next()) {
    var srcObj = objectId(rs2.getColumnValue(1), rs2.getColumnValue(2), rs2.getColumnValue(3));
    var tgtObj = objectId(rs2.getColumnValue(5), rs2.getColumnValue(6), rs2.getColumnValue(7));
    var srcCol = rs2.getColumnValue(4);
    var tgtCol = rs2.getColumnValue(8);
    if (!srcCol || !tgtCol) continue;
    colRawEdges.push({ source: srcObj + "." + srcCol, target: tgtObj + "." + tgtCol });
  }
  debug.push("Total raw column edges: " + colRawEdges.length);
  var startColumn = null;
  if (COLUMN_NAME) { startColumn = rootObjectFQN + "." + COLUMN_NAME; }
  if (startColumn) {
    var colQueue = [{ id: startColumn, dist: 0 }];
    var colVisited = {};
    colVisited[startColumn] = 0;
    while (colQueue.length > 0) {
      var cur2 = colQueue.shift();
      if (cur2.dist >= maxDepth) continue;
      colRawEdges.forEach(function(e) {
        var next = null;
        if (DIR === 'UPSTREAM' && e.target === cur2.id) next = e.source;
        if (DIR === 'DOWNSTREAM' && e.source === cur2.id) next = e.target;
        if (next && colVisited[next] === undefined) {
          colVisited[next] = cur2.dist + 1;
          colQueue.push({ id: next, dist: cur2.dist + 1 });
        }
      });
    }
    Object.keys(colVisited).forEach(function(id) {
      columnNodes[id] = { id: id, type: 'column', distance: colVisited[id] };
    });
    colRawEdges.forEach(function(e) {
      if (colVisited[e.source] !== undefined && colVisited[e.target] !== undefined) {
        var edgeId = e.source + "->" + e.target;
        columnEdges[edgeId] = { id: edgeId, source: e.source, target: e.target, type: 'column' };
      }
    });
    debug.push("Final column nodes: " + Object.keys(columnNodes).length);
    debug.push("Final column edges: " + Object.keys(columnEdges).length);
  }
}

/* ===================== RESPONSE ===================== */
return {
  object_lineage: { nodes: Object.values(objectNodes), edges: objectEdges },
  column_lineage: { nodes: Object.values(columnNodes), edges: columnEdges },
  debug: debug,
  meta: {
    db: DB_NAME, schema: SCHEMA_NAME, object: OBJECT_NAME, column: COLUMN_NAME,
    object_type: SAFE_OBJECT_TYPE, direction: DIR, max_distance: maxDepth, include_columns: INCLUDE_COLUMNS
  }
};
$$;



-- ============================================================
-- STEP 2: Create R_EXTERNAL_LINEAGE_SOURCES table
-- Stores metadata about external sources (S3, Postgres, Kafka, etc.)
-- ============================================================

CREATE TABLE IF NOT EXISTS D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_EXTERNAL_LINEAGE_SOURCES (
  SOURCE_ID NUMBER AUTOINCREMENT,
  SOURCE_NAMESPACE VARCHAR(500) NOT NULL,   -- e.g. "s3://my-data-bucket", "postgres://myhost:5432"
  SOURCE_NAME VARCHAR(500) NOT NULL,        -- e.g. "raw/customers.csv", "public.users"
  SOURCE_TYPE VARCHAR(100) NOT NULL,        -- e.g. "S3", "POSTGRES", "KAFKA", "API", "AZURE_BLOB", "GCS"
  TARGET_DATABASE VARCHAR(256) NOT NULL,
  TARGET_SCHEMA VARCHAR(256) NOT NULL,
  TARGET_TABLE VARCHAR(256) NOT NULL,
  DESCRIPTION VARCHAR(2000),
  CREATED_BY VARCHAR(256),
  CREATED_AT TIMESTAMP_NTZ DEFAULT CURRENT_TIMESTAMP(),
  IS_ACTIVE BOOLEAN DEFAULT TRUE
);

-- ============================================================
-- STEP 3: Create stage for lineage skill
-- ============================================================

CREATE STAGE IF NOT EXISTS D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.LINEAGE_SKILL_STAGE;

-- ============================================================
-- STEP 4: Grant privileges for external lineage ingestion
-- Run as ACCOUNTADMIN or role with CREATE INTEGRATION privilege
-- ============================================================


-- GRANT INGEST LINEAGE ON ACCOUNT TO ROLE X_IN_CAPG_POC_RWCX_AI_SCALABILITY_SOL;
-- (Uncomment and run as ACCOUNTADMIN if you want to use the Snowflake External Lineage REST API)



-- ============================================================
-- STEP 5: Create and configure the LINEAGE_AGENT
-- Also attach skill to AGENT_UNSTRUCTURED
-- Run these in Snowsight
-- ============================================================

-- 1) Upload skill files to stage
-- Run from your local machine:
-- snowsql -c <connection> -q "PUT file:///path/to/SKILL.md @D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.LINEAGE_SKILL_STAGE/skills/lineage_explorer/"
-- snowsql -c <connection> -q "PUT file:///path/to/lineage_explorer.py @D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.LINEAGE_SKILL_STAGE/skills/lineage_explorer/"

-- 2) Create the dedicated LINEAGE_AGENT
CREATE OR REPLACE AGENT D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.LINEAGE_AGENT
  FROM SPECIFICATION
  $$
  models:
    orchestration: claude-4-sonnet

  instructions:
    response: "You are a data lineage expert for the RAISE platform. Help users understand data flows, dependencies, cross-database connections, and external source integrations. Present results in clear, structured format with risk indicators and recommendations."

  tools:
    - tool_spec:
        type: "sql_exec"
        name: "sql_exec"
        description: "Executes SQL queries to retrieve lineage data from Snowflake"
    - tool_spec:
        type: "code_exec"
        name: "code_exec"
        description: "Executes Python code for lineage analysis"

  skills:
    - name: "lineage_explorer"
      source:
        type: "STAGE"
        path: "@D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.LINEAGE_SKILL_STAGE/skills/lineage_explorer"
  $$;

  
-- 3) Attach skill to existing AGENT_UNSTRUCTURED
-- NOTE: You need to include ALL existing fields from the current spec.
-- Use DESCRIBE AGENT to see current spec, then add the skills array.

DESCRIBE AGENT D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.LINEAGE_AGENT;

-- Example (merge with your existing spec):

-- ALTER AGENT D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.AGENT_UNSTRUCTURED
--   MODIFY LIVE VERSION
--   SET SPECIFICATION = $$
--   {
--     // ... your existing spec fields (models, instructions, tools, etc.) ...
--     "skills": [
--       {
--         "name": "lineage_explorer",
--         "source": {
--           "type": "STAGE",
--           "path": "@D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.LINEAGE_SKILL_STAGE/skills/lineage_explorer"
--         }
--       }
--     ]
--   }
--   $$;

-- 4) Verify skill is listed
-- LS @D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.LINEAGE_SKILL_STAGE/ PATTERN='.*SKILL\.md';
-- DESCRIBE AGENT D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.LINEAGE_AGENT;


SELECT SNOWFLAKE.CORTEX.DATA_AGENT_RUN(
  'D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.LINEAGE_AGENT',
  'What are the downstream dependencies of D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_SERVICES_TBL?'
);









SHOW AGENTS IN SCHEMA D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA;