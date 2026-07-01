import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import { ROUTES } from "../../constants";
import api from "../../api";
import styles from "./LineageGraphAgent.module.scss";
import { SemanticViewAPI } from "../../api/endpoints/semanticView.api";
import { useAppContext } from "../../context/AppContext";
import NotificationBanner from "../../components/ui/NotificationBanner/NotificationBanner";
import {
  addGraph,
  loadAllGraphs,
  deleteGraphById,
  type LineageGraphConfig,
} from "./lineageStorage";
import ImpactAnalysisPanel from "./components/ImpactAnalysisPanel";
import AlertLoader from "./components/AlertLoader";

type Direction = "UPSTREAM" | "DOWNSTREAM" | "BOTH";
type ObjectType = "TABLE" | "VIEW";
type YesNo = "yes" | "no";
type CatalogItemType = "TABLE" | "VIEW";
type CatalogItem = { name: string; type: CatalogItemType };
type SelectKey = `${CatalogItemType}::${string}`;
type ObjectTypeFilter = "BOTH" | "TABLE" | "VIEW";

type GraphParams = {
  graphName: string;
  dbName: string;
  schemaName: string;
  objectType: ObjectType;
  objectName: string;
  direction: Direction;
  includeColumn: YesNo;
  columnName?: string | null;
  distance?: string | null;
};

const toKey = (it: CatalogItem): SelectKey => `${it.type}::${it.name}`;

const parseKey = (key: string): { type: CatalogItemType; name: string } | null => {
  if (!key || !key.includes("::")) return null;
  const [type, name] = key.split("::");
  const valid: CatalogItemType[] = ["TABLE", "VIEW"];
  if (!valid.includes(type as CatalogItemType)) return null;
  return { type: type as CatalogItemType, name: name || "" };
};

const formatUiError = (e: any, fallbackMsg: string) => {
  const msg = e?.message || fallbackMsg;
  const status = e?.status ? ` (HTTP ${e.status})` : "";
  const code = e?.code ? ` [${e.code}]` : "";
  return `${msg}${status}${code}`;
};

function makeId() {
  return crypto?.randomUUID ? crypto.randomUUID() : String(Date.now());
}

function defaultGraphName(p: { dbName: string; schemaName: string; objectName: string; direction: Direction }) {
  return `${p.dbName}.${p.schemaName}.${p.objectName} (${p.direction})`;
}

const LineageGraphAgent: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAppContext();
  const [database, setDatabase] = useState("");
  const [schema, setSchema] = useState("");
  const [objects, setObjects] = useState<CatalogItem[]>([]);
  const [selectedObjectKey, setSelectedObjectKey] = useState<SelectKey | "">("");
  const [direction, setDirection] = useState<Direction>("BOTH");
  const [objectTypeFilter, setObjectTypeFilter] = useState<ObjectTypeFilter>("BOTH");
  const [includeColumn, setIncludeColumn] = useState<YesNo>("no");
  const [columnName, setColumnName] = useState("");
  const [distance, setDistance] = useState<string>("3");
  const [databases, setDatabases] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [graphs, setGraphs] = useState<LineageGraphConfig[]>([]);
  const [graphName, setGraphName] = useState("");
  const [toast, setToast] = useState<{ visible: boolean; type: "success" | "error" | "info"; message: string }>({
    visible: false,
    type: "success",
    message: "",
  });

  const [extSourceType, setExtSourceType] = useState<string>("S3");
  const [extNamespace, setExtNamespace] = useState<string>("");
  const [extName, setExtName] = useState<string>("");
  const [extTargetDb, setExtTargetDb] = useState<string>("");
  const [extTargetSchema, setExtTargetSchema] = useState<string>("");
  const [extTargetTable, setExtTargetTable] = useState<string>("");
  const [extDescription, setExtDescription] = useState<string>("");
  const [extRegistering, setExtRegistering] = useState(false);
  const [lineageChatOpen, setLineageChatOpen] = useState(false);
  const [lineageChatInput, setLineageChatInput] = useState("");
  const [lineageChatMessages, setLineageChatMessages] = useState<Array<{role: string; content: string}>>([]);
  const [lineageChatLoading, setLineageChatLoading] = useState(false);

  const SOURCE_TYPE_OPTIONS = ["S3", "POSTGRES", "MYSQL", "KAFKA", "API", "AZURE_BLOB", "GCS", "OTHER"];

  const handleRegisterExternalSource = async () => {
    if (!extNamespace || !extName || !extTargetDb || !extTargetSchema || !extTargetTable) {
      setToast({ visible: true, type: "error", message: "All fields except Description are required" });
      return;
    }
    setExtRegistering(true);
    try {
      await api.post("/api/external-lineage/register", {
        sourceNamespace: extNamespace,
        sourceName: extName,
        sourceType: extSourceType,
        targetDatabase: extTargetDb,
        targetSchema: extTargetSchema,
        targetTable: extTargetTable,
        description: extDescription,
        pushToSnowflake: true,
      });
      setToast({ visible: true, type: "success", message: "External source registered successfully" });
      setExtNamespace("");
      setExtName("");
      setExtDescription("");
      setExtTargetTable("");
    } catch (err: any) {
      setToast({ visible: true, type: "error", message: err?.response?.data?.error || "Registration failed" });
    } finally {
      setExtRegistering(false);
    }
  };

  const handleLineageChatSend = async () => {
    if (!lineageChatInput.trim()) return;
    const userMessage = lineageChatInput.trim();
    setLineageChatInput("");
    setLineageChatMessages(prev => [...prev, { role: "user", content: userMessage }]);
    setLineageChatLoading(true);
    try {
      const response = await api.post("/api/lineage-agent", { prompt: userMessage });
      const assistantText = response.data?.answerText || response.data?.planningText || JSON.stringify(response.data);
      setLineageChatMessages(prev => [...prev, { role: "assistant", content: assistantText }]);
    } catch (err: any) {
      setLineageChatMessages(prev => [...prev, {
        role: "assistant",
        content: `Error: ${err?.response?.data?.error || err.message || "Failed to get response"}`
      }]);
    } finally {
      setLineageChatLoading(false);
    }
  };

  console.log(graphs)

  // Fetch graphs from Snowflake backend
  const fetchGraphsFromBackend = async () => {
    try {
      const res = await api.get("/graphs");
      const rows = res.data?.data || res.data || [];
      const mapped: LineageGraphConfig[] = rows.map((row: any) => ({
        id: row.GRAPH_ID,
        graphName: row.GRAPH_NAME,
        db: row.DATABASE_NAME,
        schema: row.SCHEMA_NAME,
        objectType: row.OBJECT_TYPE,
        objectName: row.OBJECT_NAME,
        direction: row.DIRECTION,
        maxDepth: row.DISTANCE != null ? Number(row.DISTANCE) : undefined,
        includeColumn: row.INCLUDE_COLUMN ? "yes" : "no",
        createdAt: row.CREATED_AT,
      }));
      setGraphs(mapped);
    } catch {
      // Fallback to localStorage if backend fails
      setGraphs(loadAllGraphs());
    }
  };

  useEffect(() => {
    fetchGraphsFromBackend();
  }, []);

  // const parsedSelection = useMemo(() => parseKey(selectedObjectKey as string), [selectedObjectKey]);

  const filteredObjects = useMemo(() => {
    if (objectTypeFilter === "BOTH") return objects;
    return objects.filter((o) => o.type === objectTypeFilter);
  }, [objects, objectTypeFilter]);

  const canGenerate =
    !!(database && schema && selectedObjectKey && !generating) &&
    (includeColumn === "no" || (includeColumn === "yes" && columnName.trim().length > 0)) &&
    !!distance &&
    Number(distance) > 0;

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        setLoadingDatabases(true);
        const dbs = await SemanticViewAPI.getDatabases();
        setDatabases(dbs);
      } catch (e: any) {
        setError(formatUiError(e, "Failed to load databases"));
      } finally {
        setLoadingDatabases(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadSchemas = async () => {
      setSchemas([]);
      setSchema("");
      setObjects([]);
      setSelectedObjectKey("");
      if (!database) return;
      try {
        setError("");
        setLoadingSchemas(true);
        const schs = await SemanticViewAPI.getSchemas(database);
        setSchemas(schs);
      } catch (e: any) {
        setError(formatUiError(e, "Failed to load schemas"));
      } finally {
        setLoadingSchemas(false);
      }
    };
    loadSchemas();
  }, [database]);

  useEffect(() => {
    const loadObjects = async () => {
      setObjects([]);
      setSelectedObjectKey("");
      if (!database || !schema) return;
      try {
        setError("");
        setLoadingObjects(true);
        const [tables, views] = await Promise.all([
          SemanticViewAPI.getTablesBySchema(database, schema).catch(() => [] as string[]),
          SemanticViewAPI.getViewsBySchema(database, schema).catch(() => [] as string[]),
        ]);
        const combined: CatalogItem[] = [
          ...tables.map((name) => ({ name, type: "TABLE" as const })),
          ...views.map((name) => ({ name, type: "VIEW" as const })),
        ].sort((a, b) => a.name.localeCompare(b.name) || a.type.localeCompare(b.type));
        setObjects(combined);
      } catch (e: any) {
        setError(formatUiError(e, "Failed to load objects"));
        setObjects([]);
      } finally {
        setLoadingObjects(false);
      }
    };
    loadObjects();
  }, [database, schema]);

  async function requestLineage(p: GraphParams) {
    const params: any = {
      graphName: p.graphName,
      dbName: p.dbName,
      schemaName: p.schemaName,
      objectName: p.objectName,
      objectType: p.objectType,
      includeColumn: p.includeColumn,
      direction: p.direction,
    };
    if (p.distance) params.distance = p.distance;
    if (p.includeColumn === "yes" && p.columnName) params.columnName = p.columnName;
    const res = await api.get("/lineage", { params });
    return res.data;
  }

  const handleGenerate = async () => {
    console.log("Generate button clicked for /lineage", { database, schema, selectedObjectKey, direction, distance, includeColumn, columnName });
    if (!canGenerate) return;
    try {
      setGenerating(true);
      setError("");
      const parsed = parseKey(selectedObjectKey as string);
      if (!parsed) {
        setError("Invalid object selection");
        return;
      }
      const p: GraphParams = {
        graphName: graphName?.trim() || defaultGraphName({
          dbName: database,
          schemaName: schema,
          objectName: parsed.name,
          direction,
        }),
        dbName: database,
        schemaName: schema,
        objectType: parsed.type as ObjectType,
        objectName: parsed.name,
        direction,
        includeColumn,
        columnName: includeColumn === "yes" ? columnName.trim().toUpperCase() : null,
        distance: distance ? String(distance).trim() : null,
      };
      const lineageResponse = await requestLineage(p);
      const graphId = makeId();
      const config: LineageGraphConfig = {
        id: graphId,
        graphName: p.graphName,
        db: p.dbName,
        schema: p.schemaName,
        objectType: p.objectType,
        objectName: p.objectName,
        direction: p.direction,
        maxDepth: p.distance ? Number(p.distance) : undefined,
        includeColumn: p.includeColumn,
        columnName: p.columnName || undefined,
        createdAt: new Date().toISOString(),
      };

      // Save to Snowflake backend
      await api.post("/save-graph", {
        graphId,
        graphName: p.graphName,
        databaseName: p.dbName,
        schemaName: p.schemaName,
        objectName: p.objectName,
        objectType: p.objectType,
        direction: p.direction,
        distance: p.distance ? Number(p.distance) : null,
        includeColumn: p.includeColumn,
        graphPayload: lineageResponse,
        createdBy: currentUser?.USERNAME || "unknown",
      });

      // Also keep in localStorage as cache
      addGraph(config);
      // Refresh list from backend
      await fetchGraphsFromBackend();
      setToast({ visible: true, type: "success", message: "Graph Generated successfully" });
      setGraphName("");
      setColumnName("");
      setIncludeColumn("no");
      setDistance("3");
    } catch (e: any) {
      setError(formatUiError(e, "Generate failed"));
      setToast({ visible: true, type: "error", message: formatUiError(e, "Failed to generate graph") });
    } finally {
      setGenerating(false);
    }
  };

  const handleView = (g: LineageGraphConfig) => {
    navigate(`${ROUTES.LINEAGE_GRAPH_VIEW}/${g.id}`, { state: g });
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/graphs/${id}`);
      deleteGraphById(id); // Also remove from localStorage cache
      await fetchGraphsFromBackend();
      setToast({ visible: true, type: "success", message: "Graph deleted successfully" });
    } catch {
      // Fallback: remove from localStorage only
      deleteGraphById(id);
      setGraphs(loadAllGraphs());
      setToast({ visible: true, type: "error", message: "Failed to delete graph from server" });
    }
  };

  const dbId = "dbSelect";
  const schemaId = "schemaSelect";
  const objId = "objectSelect";
  const typeId = "typeFilterSelect";
  const dirId = "directionSelect";
  const nameId = "graphNameInput";
  const includeColId = "includeColumnSelect";
  const colNameId = "columnNameInput";
  const distId = "distanceInput";

  return (
    <div className={styles.wrapper}>
      <NotificationBanner
        type={toast.type}
        message={toast.message}
        visible={toast.visible}
        onClose={() => setToast((prev) => ({ ...prev, visible: false }))}
      />
      <h2 className={styles.pageTitle}>Lineage Explorer</h2>
      <p className={styles.subtitle}>Visualize relationships across your data ecosystem</p>
      {error && <div className={styles.errorBox}>{error}</div>}
      <div className={styles.formCard}>
        <div className={styles.formInner}>
          <div className={styles.gridThreeCols}>
            <div className={styles.gridItem}>
              <div className={styles.selectWrap}>
                <label htmlFor={nameId} className={styles.label}>Graph name</label>
                <input
                  id={nameId}
                  className={styles.select}
                  value={graphName}
                  onChange={(e) => setGraphName(e.target.value)}
                  placeholder="Enter graph name"
                />
              </div>
            </div>
            <div className={styles.gridItem}>
              <div className={styles.selectWrap}>
                <label htmlFor={dbId} className={styles.label}>Database</label>
                <Autocomplete
                  id={dbId}
                  options={databases}
                  value={database || null}
                  onChange={(_e, newValue) => setDatabase(newValue || "")}
                  loading={loadingDatabases}
                  disabled={loadingDatabases}
                  size="small"
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={loadingDatabases ? "Loading databases..." : "Search database"}
                      className={styles.autocompleteInput}
                    />
                  )}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px", background: "#f9fbff", height: 48 } }}
                />
              </div>
            </div>
            <div className={styles.gridItem}>
              <div className={styles.selectWrap}>
                <label htmlFor={schemaId} className={styles.label}>Schema</label>
                <Autocomplete
                  id={schemaId}
                  options={schemas}
                  value={schema || null}
                  onChange={(_e, newValue) => setSchema(newValue || "")}
                  loading={loadingSchemas}
                  disabled={!database || loadingSchemas}
                  size="small"
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={loadingSchemas ? "Loading schemas..." : "Search schema"}
                      className={styles.autocompleteInput}
                    />
                  )}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px", background: "#f9fbff", height: 48 } }}
                />
              </div>
            </div>
            <div className={styles.gridItem}>
              <div className={styles.selectWrap}>
                <label htmlFor={typeId} className={styles.label}>Object type</label>
                <select
                  id={typeId}
                  className={styles.select}
                  value={objectTypeFilter}
                  onChange={(e) => setObjectTypeFilter(e.target.value as ObjectTypeFilter)}
                  disabled={!database || !schema || loadingObjects}
                >
                  <option value="BOTH">Both</option>
                  <option value="TABLE">Table</option>
                  <option value="VIEW">View</option>
                </select>
              </div>
            </div>
            <div className={styles.gridItem}>
              <div className={styles.selectWrap}>
                <label htmlFor={objId} className={styles.label}>Object name</label>
                <Autocomplete
                  id={objId}
                  options={filteredObjects}
                  getOptionLabel={(option) => option.name}
                  value={filteredObjects.find((o) => toKey(o) === selectedObjectKey) || null}
                  onChange={(_e, newValue) => setSelectedObjectKey(newValue ? toKey(newValue) : "")}
                  loading={loadingObjects}
                  disabled={!database || !schema || loadingObjects}
                  size="small"
                  isOptionEqualToValue={(option, value) => toKey(option) === toKey(value)}
                  renderOption={(props, option) => (
                    <li {...props} key={toKey(option)}>
                      <span>{option.name}</span>
                      <span style={{ marginLeft: "auto", fontSize: 11, color: "#6b7280" }}>{option.type}</span>
                    </li>
                  )}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      placeholder={loadingObjects ? "Loading objects..." : "Search object"}
                      className={styles.autocompleteInput}
                    />
                  )}
                  sx={{ "& .MuiOutlinedInput-root": { borderRadius: "10px", background: "#f9fbff", height: 48 } }}
                />
              </div>
            </div>
            <div className={styles.gridItem}>
              <div className={styles.selectWrap}>
                <label htmlFor={dirId} className={styles.label}>Direction</label>
                <select
                  id={dirId}
                  className={styles.select}
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as Direction)}
                  disabled={!database || !schema || loadingObjects}
                >
                  <option value="BOTH">Both</option>
                  <option value="UPSTREAM">Upstream</option>
                  <option value="DOWNSTREAM">Downstream</option>
                </select>
              </div>
            </div>
            <div className={styles.gridItem}>
              <div className={styles.selectWrap}>
                <label htmlFor={includeColId} className={styles.label}>Include column</label>
                <select
                  id={includeColId}
                  className={styles.select}
                  value={includeColumn}
                  onChange={(e) => setIncludeColumn(e.target.value as YesNo)}
                  disabled={!database || !schema || loadingObjects}
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>
            </div>
            <div className={styles.gridItem}>
              <div className={styles.selectWrap}>
                <label htmlFor={colNameId} className={styles.label}>
                  Column name {includeColumn === "yes" && <span style={{ color: "#d00" }}>*</span>}
                </label>
                <input
                  id={colNameId}
                  className={styles.select}
                  value={columnName}
                  onChange={(e) => setColumnName(e.target.value)}
                  placeholder="e.g. AMOUNT"
                  disabled={includeColumn === "no"}
                />
              </div>
            </div>
            <div className={styles.gridItem}>
              <div className={styles.selectWrap}>
                <label htmlFor={distId} className={styles.label}>Distance</label>
                <input
                  id={distId}
                  type="number"
                  min={1}
                  max={25}
                  className={styles.select}
                  value={distance}
                  onChange={(e) => setDistance(e.target.value)}
                  placeholder="Depth (e.g. 3)"
                />
                {/* {Number(distance) > 5 && (
                  <span style={{ fontSize: 10, color: '#f59e0b', marginTop: 2, display: 'block' }}>
                    Extended depth ({distance}) — uses recursive fetching
                  </span>
                )} */}
              </div>
            </div>
          </div>
          <div className={styles.buttonRow}>
            <button
              className={styles.primaryBtn}
              onClick={handleGenerate}
              disabled={!canGenerate}
            >
              {generating ? "Generating..." : "Generate"}
            </button>
          </div>
        </div>
      </div>
      <div className={styles.graphCard}>
        <div className={styles.tableSection}>
          <div className={styles.tableHeader}>
            <h3 className={styles.tableTitle}>Generated Graphs</h3>
            <span className={styles.graphCount}>{graphs.length} graph{graphs.length !== 1 ? "s" : ""}</span>
          </div>
          {graphs.length === 0 ? (
            <div className={styles.emptyText}>No graphs created yet.</div>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead className={styles.thead}>
                  <tr>
                    <th className={styles.th}>#</th>
                    <th className={styles.th}>Graph Name</th>
                    <th className={styles.th}>Object</th>
                    <th className={styles.th}>Direction</th>
                    <th className={styles.th}>Created</th>
                    <th className={`${styles.th} ${styles.thAction}`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {graphs.map((g, idx) => (
                    <tr key={g.id} className={styles.tr}>
                      <td className={styles.td}>{idx + 1}</td>
                      <td className={styles.td}>{g.graphName}</td>
                      <td className={styles.td}>
                        <span className={styles.objectCell}>
                          <span className={styles.objectName}>{g.objectName}</span>
                          <span className={styles.objectType}>{g.objectType}</span>
                        </span>
                      </td>
                      <td className={styles.td}>
                        <span className={`${styles.dirBadge} ${styles[`dir${g.direction}`]}`}>
                          {g.direction}
                        </span>
                      </td>
                      <td className={styles.td}>
                        {new Date(g.createdAt).toLocaleDateString()}
                      </td>
                      <td className={`${styles.td} ${styles.tdAction}`}>
                        <div className={styles.actions}>
                          <button
                            type="button"
                            className={`${styles.iconBtn} ${styles.viewBtn}`}
                            onClick={() => handleView(g)}
                            title="View Graph"
                            aria-label="View Graph"
                          >
                            <VisibilityOutlinedIcon fontSize="small" />
                          </button>
                          <button
                            type="button"
                            className={`${styles.iconBtn} ${styles.deleteBtn}`}
                            onClick={() => handleDelete(g.id)}
                            title="Delete Graph"
                            aria-label="Delete Graph"
                          >
                            <DeleteOutlinedIcon fontSize="small" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* External Source Registration */}
      <div className={styles.section} style={{ marginTop: 32, padding: 20, border: "1px solid #e0e0e0", borderRadius: 8 }}>
        <h3 style={{ marginBottom: 12 }}>Register External Data Source</h3>
        <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
          Register external sources (S3, Postgres, Kafka, etc.) to display them in your lineage insight engine.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Autocomplete
            options={SOURCE_TYPE_OPTIONS}
            value={extSourceType}
            onChange={(_, val) => setExtSourceType(val || "S3")}
            renderInput={(params) => <TextField {...params} label="Source Type" size="small" />}
          />
          <TextField label="Source Namespace" placeholder="e.g. s3://my-bucket" size="small" value={extNamespace} onChange={(e) => setExtNamespace(e.target.value)} />
          <TextField label="Source Name" placeholder="e.g. raw/data.csv" size="small" value={extName} onChange={(e) => setExtName(e.target.value)} />
          <TextField label="Target Database" size="small" value={extTargetDb} onChange={(e) => setExtTargetDb(e.target.value)} />
          <TextField label="Target Schema" size="small" value={extTargetSchema} onChange={(e) => setExtTargetSchema(e.target.value)} />
          <TextField label="Target Table" size="small" value={extTargetTable} onChange={(e) => setExtTargetTable(e.target.value)} />
        </div>
        <TextField label="Description (optional)" size="small" fullWidth multiline rows={2} value={extDescription} onChange={(e) => setExtDescription(e.target.value)} style={{ marginTop: 12 }} />
        <button onClick={handleRegisterExternalSource} disabled={extRegistering} style={{ marginTop: 12, padding: "8px 24px" }}>
          {extRegistering ? "Registering..." : "Register External Source"}
        </button>
      </div>

      {/* AI Lineage Chat */}
      <div className={styles.section} style={{ marginTop: 24, padding: 20, border: "1px solid #e0e0e0", borderRadius: 8 }}>
        <h3 style={{ marginBottom: 12, cursor: "pointer" }} onClick={() => setLineageChatOpen(!lineageChatOpen)}>
          Ask AI About Lineage {lineageChatOpen ? "▲" : "▼"}
        </h3>
        {lineageChatOpen && (
          <div style={{ border: "1px solid #e0e0e0", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ maxHeight: 300, overflowY: "auto", padding: 12, background: "#fafafa" }}>
              {lineageChatMessages.length === 0 && (
                <p style={{ color: "#999", fontSize: 13, textAlign: "center" }}>
                  Ask questions like &quot;What feeds into TABLE_X?&quot; or &quot;What depends on MY_VIEW?&quot;
                </p>
              )}
              {lineageChatMessages.map((msg, idx) => (
                <div key={idx} style={{ marginBottom: 8, padding: "8px 12px", borderRadius: 8, background: msg.role === "user" ? "#e3f2fd" : "#fff", border: msg.role === "assistant" ? "1px solid #e0e0e0" : "none", fontSize: 13, whiteSpace: "pre-wrap" }}>
                  <strong>{msg.role === "user" ? "You" : "AI"}:</strong> {msg.content}
                </div>
              ))}
              {lineageChatLoading && <div style={{ textAlign: "center", padding: 8, fontSize: 12, color: "#666" }}>Analyzing lineage...</div>}
            </div>
            <div style={{ display: "flex", gap: 8, padding: 8, borderTop: "1px solid #e0e0e0" }}>
              <TextField size="small" fullWidth placeholder="Ask about lineage, dependencies, or data sources..." value={lineageChatInput} onChange={(e) => setLineageChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleLineageChatSend(); } }} disabled={lineageChatLoading} />
              <button onClick={handleLineageChatSend} disabled={lineageChatLoading || !lineageChatInput.trim()} style={{ padding: "6px 16px", whiteSpace: "nowrap" }}>Send</button>
            </div>
          </div>
        )}
      </div>

      {/* Impact Analysis */}
      <div className={styles.section} style={{ marginTop: 24, padding: 20, border: "1px solid #e2e8f0", borderRadius: 8, background: "#fafbfc" }}>
        <ImpactAnalysisPanel
          selectedNode={null}
          onHighlightNodes={(nodeIds, severity) => {
            console.log("[ImpactAnalysis] Highlight nodes:", nodeIds, severity);
          }}
        />
      </div>

      {/* Alert Loader */}
      <div className={styles.section} style={{ marginTop: 24 }}>
        <AlertLoader
          onAlertCountChange={(count) => {
            console.log("[AlertLoader] Unacknowledged alerts:", count);
          }}
          onViewInGraph={(nodeId) => {
            console.log("[AlertLoader] View in graph:", nodeId);
          }}
        />
      </div>
    </div>
  );
};

export default LineageGraphAgent;