
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./SemanticViewAgent.module.scss";
import { ROUTES } from "../../constants";
import { SemanticViewAPI } from "../../api/endpoints/semanticView.api";

type ScriptRow = {
  queryId: string;
  name: string;
  date: string;
  database: string;
  schema: string;
  tables: string[];
  sql: string; // ✅ SQL only
};

const STORAGE_KEY = "semantic_view_agent_scripts_sql_v1";

const formatDateDDMMYYYY = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const generateQueryId = () => `S${Date.now()}`;

const loadScripts = (): ScriptRow[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as ScriptRow[]) : [];
  } catch {
    return [];
  }
};

const saveScripts = (rows: ScriptRow[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows));
};

const formatUiError = (e: any, fallbackMsg: string) => {
  const msg = e?.message || fallbackMsg;
  const status = e?.status ? ` (HTTP ${e.status})` : "";
  const code = e?.code ? ` [${e.code}]` : "";
  return `${msg}${status}${code}`;
};

// ✅ Multi-select dropdown with checkboxes (no Ctrl key required)
type MultiSelectProps = {
  items: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  placeholder?: string;
  loading?: boolean;
};

const MultiSelectDropdown: React.FC<MultiSelectProps> = ({
  items,
  selected,
  onChange,
  disabled,
  placeholder = "Select tables",
  loading,
}) => {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const toggleItem = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter((x) => x !== value));
    else onChange([...selected, value]);
  };

  const selectAll = () => onChange(items.slice());
  const clearAll = () => onChange([]);

  const label = useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) return selected[0];
    if (selected.length === 2) return `${selected[0]}, ${selected[1]}`;
    return `${selected[0]}, ${selected[1]} +${selected.length - 2} more`;
  }, [selected, placeholder]);

  return (
    <div className={styles.msWrap} ref={wrapRef}>
      <button
        type="button"
        className={styles.msControl}
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
      >
        <span className={selected.length === 0 ? styles.msPlaceholder : styles.msValue}>
          {loading ? "Loading tables..." : label}
        </span>
        <span className={styles.msChevron} aria-hidden="true">
          ▾
        </span>
      </button>

      {open && !disabled && !loading && (
        <div className={styles.msMenu} role="listbox" aria-multiselectable="true">
          <div className={styles.msMenuTop}>
            <button type="button" className={styles.msMiniBtn} onClick={selectAll} disabled={!items.length}>
              Select all
            </button>
            <button type="button" className={styles.msMiniBtn} onClick={clearAll} disabled={!selected.length}>
              Clear
            </button>
          </div>

          <div className={styles.msList}>
            {items.length === 0 ? (
              <div className={styles.msEmpty}>No tables found.</div>
            ) : (
              items.map((t) => (
                <label key={t} className={styles.msItem}>
                  <input type="checkbox" checked={selected.includes(t)} onChange={() => toggleItem(t)} />
                  <span className={styles.msItemText}>{t}</span>
                </label>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const SemanticViewAgent: React.FC = () => {
  const navigate = useNavigate();

  // form
  const [scriptName, setScriptName] = useState("");
  const [database, setDatabase] = useState("");
  const [schema, setSchema] = useState("");
  const [selectedTables, setSelectedTables] = useState<string[]>([]);

  // dropdown data
  const [databases, setDatabases] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);

  // UI
  const [loadingDatabases, setLoadingDatabases] = useState(false);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  // scripts
  const [scripts, setScripts] = useState<ScriptRow[]>(() => loadScripts());

  // pagination
  const pageSize = 3;
  const [page, setPage] = useState(1);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(scripts.length / pageSize)), [scripts.length]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return scripts.slice(start, start + pageSize);
  }, [scripts, page]);

  // Load databases
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

  // Load schemas
  useEffect(() => {
    const loadSchemas = async () => {
      if (!database) {
        setSchemas([]);
        setSchema("");
        setTables([]);
        setSelectedTables([]);
        return;
      }

      try {
        setError("");
        setLoadingSchemas(true);
        const schs = await SemanticViewAPI.getSchemas(database);
        setSchemas(schs);

        setSchema("");
        setTables([]);
        setSelectedTables([]);
      } catch (e: any) {
        setError(formatUiError(e, "Failed to load schemas"));
      } finally {
        setLoadingSchemas(false);
      }
    };
    loadSchemas();
  }, [database]);

  // Load tables
  useEffect(() => {
    const loadTables = async () => {
      if (!database || !schema) {
        setTables([]);
        setSelectedTables([]);
        return;
      }

      try {
        setError("");
        setLoadingTables(true);
        const tbls = await SemanticViewAPI.getTablesBySchema(database, schema);
        setTables(tbls);
        setSelectedTables([]);
      } catch (e: any) {
        setError(formatUiError(e, "Failed to load tables"));
      } finally {
        setLoadingTables(false);
      }
    };

    loadTables();
  }, [database, schema]);

  // persist scripts
  useEffect(() => {
    saveScripts(scripts);
    if (page > totalPages) setPage(totalPages);
  }, [scripts, page, totalPages]);

  const canGenerate =
    scriptName.trim().length > 0 &&
    database &&
    schema &&
    selectedTables.length > 0 &&
    !generating;

  const handleGenerate = async () => {
    if (!canGenerate) return;

    try {
      setGenerating(true);
      setError("");

      // ✅ SQL generation
      const result = await SemanticViewAPI.generateSql({
        modelName: scriptName.trim(),
        database,
        schema,
        tables: selectedTables,
      });

      const newRow: ScriptRow = {
        queryId: generateQueryId(),
        name: scriptName.trim(),
        date: formatDateDDMMYYYY(new Date()),
        database,
        schema,
        tables: selectedTables,
        sql: result.sql,
      };

      setScripts((prev) => [newRow, ...prev]);
      setPage(1);

      setScriptName("");
      setSelectedTables([]);
    } catch (e: any) {
      setError(formatUiError(e, "Generate failed"));
    } finally {
      setGenerating(false);
    }
  };

  const handleView = (row: ScriptRow) => {
    navigate(`${ROUTES.SEMANTIC_VIEW_AGENT_VIEW}/${row.queryId}`, { state: row });
  };

  const handleEdit = (row: ScriptRow) => {
    navigate(`${ROUTES.SEMANTIC_VIEW_AGENT_EDIT}/${row.queryId}`, { state: row });
  };

  const goPrev = () => setPage((p) => Math.max(1, p - 1));
  const goNext = () => setPage((p) => Math.min(totalPages, p + 1));

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.pageTitle}>Semantic View Creation Agent</h2>

      {error && <div className={styles.errorBox}>{error}</div>}

      <div className={styles.formCard}>
        <div className={styles.formInner}>
          <input
            className={styles.textInput}
            placeholder="Enter script name"
            value={scriptName}
            onChange={(e) => setScriptName(e.target.value)}
          />

          <div className={styles.selectRow}>
            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                disabled={loadingDatabases}
              >
                <option value="" disabled>
                  {loadingDatabases ? "Loading databases..." : "Select database"}
                </option>
                {databases.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.selectWrap}>
              <select
                className={styles.select}
                value={schema}
                onChange={(e) => setSchema(e.target.value)}
                disabled={!database || loadingSchemas}
              >
                <option value="" disabled>
                  {loadingSchemas ? "Loading schemas..." : "Select schema"}
                </option>
                {schemas.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <MultiSelectDropdown
              items={tables}
              selected={selectedTables}
              onChange={setSelectedTables}
              disabled={!database || !schema}
              loading={loadingTables}
              placeholder="Select tables"
            />
          </div>

          <div className={styles.buttonRow}>
            <button className={styles.primaryBtn} onClick={handleGenerate} disabled={!canGenerate}>
              {generating ? "Generating..." : "Generate script"}
            </button>
          </div>
        </div>
      </div>

      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.thSmall}>S.no</th>
              <th>Script name</th>
              <th className={styles.thDate}>Date</th>
              <th className={styles.thAction}>Action</th>
            </tr>
          </thead>

          <tbody>
            {pagedRows.map((row, idx) => (
              <tr key={row.queryId}>
                <td>{(page - 1) * pageSize + idx + 1}</td>
                <td>{row.name}</td>
                <td>{row.date}</td>
                <td>
                  <div className={styles.actions}>
                    <button type="button" className={styles.iconBtn} onClick={() => handleView(row)} title="View">
                      👁
                    </button>
                    <button type="button" className={styles.iconBtn} onClick={() => handleEdit(row)} title="Edit">
                      ✏️
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {pagedRows.length === 0 && (
              <tr>
                <td colSpan={4} className={styles.empty}>
                  No scripts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div className={styles.pagination}>
          <button className={styles.pageBtn} onClick={goPrev} disabled={page === 1}>‹</button>
          {Array.from({ length: totalPages }).map((_, i) => {
            const p = i + 1;
            return (
              <button
                key={p}
                className={`${styles.pageNumber} ${p === page ? styles.activePage : ""}`}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            );
          })}
          <button className={styles.pageBtn} onClick={goNext} disabled={page === totalPages}>›</button>
        </div>
      </div>
    </div>
  );
};

export default SemanticViewAgent;
