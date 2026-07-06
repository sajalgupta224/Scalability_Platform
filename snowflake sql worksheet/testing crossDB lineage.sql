-- Use your role
USE ROLE X_IN_CAPG_POC_RWCX_AI_SCALABILITY_SOL;
USE WAREHOUSE W_IN_CAPG_AI_SCALABILITY_SOL_XS;

-- Create a source table in your existing DB
USE DATABASE D_IN_CAPG_POC_AI_SCALABILITY;
USE SCHEMA AI_SCALABILITY_SCHEMA;

CREATE OR REPLACE TABLE R_LINEAGE_TEST_SOURCE (
  ID NUMBER,
  CUSTOMER_NAME VARCHAR(100),
  REVENUE NUMBER(10,2),
  CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP()
);

INSERT INTO R_LINEAGE_TEST_SOURCE VALUES
  (1, 'Acme Corp', 50000.00, CURRENT_TIMESTAMP()),
  (2, 'Globex Inc', 75000.00, CURRENT_TIMESTAMP()),
  (3, 'Stark Industries', 120000.00, CURRENT_TIMESTAMP());

-- Create a downstream table using CTAS (same DB, different schema or same schema)
-- This creates lineage: R_LINEAGE_TEST_SOURCE → R_LINEAGE_TEST_DOWNSTREAM
CREATE OR REPLACE TABLE R_LINEAGE_TEST_DOWNSTREAM AS
  SELECT ID, CUSTOMER_NAME, REVENUE * 1.1 AS ADJUSTED_REVENUE
  FROM R_LINEAGE_TEST_SOURCE;

-- Create a view on top (adds another hop)
CREATE OR REPLACE VIEW VW_LINEAGE_TEST_REPORT AS
  SELECT CUSTOMER_NAME, ADJUSTED_REVENUE
  FROM R_LINEAGE_TEST_DOWNSTREAM
  WHERE ADJUSTED_REVENUE > 60000;





----------------verifying-------------------------------

SELECT *
FROM TABLE(SNOWFLAKE.CORE.GET_LINEAGE(
  'D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_LINEAGE_TEST_SOURCE',
  'TABLE',
  'DOWNSTREAM',
  5
));

------------------------------inserting data manually-------------------------------------------------------------

INSERT INTO D_IN_CAPG_POC_AI_SCALABILITY.AI_SCALABILITY_SCHEMA.R_EXTERNAL_LINEAGE_SOURCES
  (SOURCE_NAMESPACE, SOURCE_NAME, SOURCE_TYPE, TARGET_DATABASE, TARGET_SCHEMA, TARGET_TABLE, DESCRIPTION, CREATED_BY)
VALUES
  ('s3://capgemini-data-lake', 'raw/customers/customers_2024.csv', 'S3', 
   'D_IN_CAPG_POC_AI_SCALABILITY', 'AI_SCALABILITY_SCHEMA', 'R_LINEAGE_TEST_SOURCE',
   'Customer data loaded from S3 data lake', 'SAJAL_GUPTA');



INSERT INTO R_EXTERNAL_LINEAGE_SOURCES
  (SOURCE_NAMESPACE, SOURCE_NAME, SOURCE_TYPE, TARGET_DATABASE, TARGET_SCHEMA, TARGET_TABLE, DESCRIPTION, CREATED_BY)
VALUES
  -- Postgres source feeding into your test table
  ('postgres://capg-prod-db.rds.amazonaws.com:5432', 'public.customers', 'POSTGRES',
   'D_IN_CAPG_POC_AI_SCALABILITY', 'AI_SCALABILITY_SCHEMA', 'R_LINEAGE_TEST_SOURCE',
   'Customer master data from production Postgres RDS', 'SAJAL_GUPTA'),

  -- Kafka topic feeding into a different table
  ('kafka://kafka-cluster.capgemini.com:9092', 'topic.orders.realtime', 'KAFKA',
   'D_IN_CAPG_POC_AI_SCALABILITY', 'AI_SCALABILITY_SCHEMA', 'R_LINEAGE_TEST_DOWNSTREAM',
   'Real-time order events from Kafka stream', 'SAJAL_GUPTA'),

  -- Azure Blob feeding into a table
  ('azure://capgstorage.blob.core.windows.net/raw-data', 'invoices/2024/invoice_data.parquet', 'AZURE_BLOB',
   'D_IN_CAPG_POC_AI_SCALABILITY', 'AI_SCALABILITY_SCHEMA', 'R_LINEAGE_TEST_SOURCE',
   'Invoice data from Azure Blob Storage', 'SAJAL_GUPTA'),

  -- REST API source
  ('https://api.salesforce.com/v2', 'accounts/bulk_export', 'API',
   'D_IN_CAPG_POC_AI_SCALABILITY', 'AI_SCALABILITY_SCHEMA', 'R_LINEAGE_TEST_DOWNSTREAM',
   'Salesforce account data via REST API bulk export', 'SAJAL_GUPTA'),

  -- GCS bucket source
  ('gcs://capgemini-analytics-bucket', 'raw/marketing/campaigns_2024.csv', 'GCS',
   'D_IN_CAPG_POC_AI_SCALABILITY', 'AI_SCALABILITY_SCHEMA', 'VW_LINEAGE_TEST_REPORT',
   'Marketing campaign data from Google Cloud Storage', 'SAJAL_GUPTA');

  