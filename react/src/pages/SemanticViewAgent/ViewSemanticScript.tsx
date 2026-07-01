
import React, { useMemo } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import styles from "./ViewSemanticScript.module.scss";

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

const ViewSemanticScript: React.FC = () => {
  const navigate = useNavigate();
  const { queryId } = useParams();
  const { state } = useLocation();

  const rowFromState = state as ScriptRow | undefined;

  const rowFromStorage = useMemo(() => {
    if (!queryId) return undefined;
    return loadScripts().find((x) => x.queryId === queryId);
  }, [queryId]);

  const row = rowFromState || rowFromStorage;

  return (
    <div className={styles.wrapper}>
      <h2 className={styles.pageTitle}>View script</h2>

      {/* keep code but hide using CSS if you want */}
      <div className={styles.queryId}>
        Query ID: <span>{queryId ?? "N/A"}</span>
      </div>

      <div className={styles.scriptCard}>
        <pre className={styles.code}>
          {row?.sql || "No SQL found. Please go back and open from list page."}
        </pre>
      </div>

      <div className={styles.actions}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          ← Back
        </button>
      </div>
    </div>
  );
};

export default ViewSemanticScript;
