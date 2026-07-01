
import React, { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import styles from "./EditSemanticScript.module.scss";

type ScriptRow = {
  queryId: string;
  name: string;
  date: string;
  database: string;
  schema: string;
  tables: string[];
  sql: string;
};

const STORAGE_KEY = "semantic_view_agent_scripts_sql_v1";

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

const EditSemanticScript: React.FC = () => {
  const navigate = useNavigate();
  const { queryId } = useParams();
  const { state } = useLocation();

  const rowFromState = state as ScriptRow | undefined;

  const rowFromStorage = useMemo(() => {
    if (!queryId) return undefined;
    return loadScripts().find((x) => x.queryId === queryId);
  }, [queryId]);

  const row = rowFromState || rowFromStorage;
  const [sql, setSql] = useState(row?.sql ?? "");

  const onUpdate = () => {
    if (!queryId) return;

    const all = loadScripts();
    const updated = all.map((x) => (x.queryId === queryId ? { ...x, sql } : x));
    saveScripts(updated);

    navigate(-1);
  };

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.pageTitle}>Edit script</h2>

      {/* keep code but hide using CSS if you want */}
      <div className={styles.queryId}>
        Query ID: <span>{queryId ?? "N/A"}</span>
      </div>

      <div className={styles.scriptCard}>
        <textarea
          className={styles.editor}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          placeholder="Edit SQL here..."
        />
      </div>

      <div className={styles.actions}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          ← Back
        </button>

        <button className={styles.updateBtn} onClick={onUpdate} disabled={!sql.trim()}>
          Update
        </button>
      </div>
    </div>
  );
};

export default EditSemanticScript;
