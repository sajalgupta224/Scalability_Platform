
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PipelineForm from '../../components/ui/PipelineForm/PipelineForm';
import type { PipelineFormData } from '../../types/dataPreparation';
import type { SchemasByDb, FilesByLocation } from '../../types/pages.types';
import styles from './CreatePipeline.module.scss';
import { getModeDisplay } from '../Application/Application';
import { useAppContext } from '../../context/AppContext';
import { PipelineAPI } from '../../api/endpoints/pipeline.api';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
const encode = (v: string) => encodeURIComponent(v);

const normalizeStringList = (x: unknown): string[] => {
  if (Array.isArray(x)) {
    return (x as unknown[]).filter((v) => typeof v === 'string') as string[];
  }

  if (x && typeof x === 'object') {
    const data = (x as any)?.data;
    if (Array.isArray(data)) {
      return (data as unknown[]).filter((v) => typeof v === 'string') as string[];
    }
    return Object.keys(x as Record<string, unknown>);
  }

  return [];
};

const getList = async (url: string): Promise<string[]> => {
  console.log('[GET]', url);

  const res = await fetch(url);
  let text = '';

  try {
    text = await res.text();
  } catch {
    text = '';
  }

  if (!res.ok) {
    let serverMessage = '';
    try {
      const parsed = text ? JSON.parse(text) : {};
      serverMessage = parsed?.message || parsed?.error || '';
    } catch {
      // ignore
    }

    const msg = `${url} -> ${res.status}${
      serverMessage ? ` — ${serverMessage}` : text ? ` — ${text.slice(0, 200)}` : ''
    }`;

    console.error('[GET] failed:', msg);
    throw new Error(msg);
  }

  let json: unknown = [];
  try {
    json = text ? JSON.parse(text) : [];
  } catch {
    json = [];
  }

  return normalizeStringList(json);
};

const CreatePipeline: React.FC = () => {
  const navigate = useNavigate();
  const { mode } = useAppContext();

  const [databases, setDatabases] = useState<string[]>([]);
  const [schemasByDb, setSchemasByDb] = useState<SchemasByDb>({});
  const [fileLocations, setFileLocations] = useState<string[]>([]);
  const [filesByLocation, setFilesByLocation] = useState<FilesByLocation>({});

  // Talk-to-Document DB states
  const [tables, setTables] = useState<string[]>([]);
  const [columnsByTable, setColumnsByTable] = useState<Record<string, string[]>>({});

  // Talk-to-Data DB states
  const [semanticViews, setSemanticViews] = useState<string[]>([]);
  const [semanticModels, setSemanticModels] = useState<string[]>([]);

  const chunkingMethodOptions = [
    { value: 'FixedSizeChunking', label: 'Fixed Size Chunking' },
    { value: 'RecursiveChunking', label: 'Recursive Chunking' },
  ];

  useEffect(() => {
    const loadDatabases = async () => {
      try {
        const list = await getList(`${API_BASE}/api/databases`);
        setDatabases(list);
      } catch (err) {
        console.error('Error loading databases:', err);
        setDatabases([]);
      }
    };

    loadDatabases();
  }, []);

  const fetchSchemas = async (db: string) => {
    try {
      const list = await getList(`${API_BASE}/api/schemas?db=${encode(db)}`);
      setSchemasByDb((prev) => ({ ...prev, [db]: list }));

      // reset dependent state
      setFileLocations([]);
      setFilesByLocation({});
      setTables([]);
      setColumnsByTable({});
      setSemanticViews([]);
      setSemanticModels([]);
    } catch (err) {
      console.error('Error loading schemas:', err);
      setSchemasByDb((prev) => ({ ...prev, [db]: [] }));
      setFileLocations([]);
      setFilesByLocation({});
      setTables([]);
      setColumnsByTable({});
      setSemanticViews([]);
      setSemanticModels([]);
    }
  };

  const fetchStages = async (db: string, schema: string) => {
    try {
      const list = await getList(
        `${API_BASE}/api/stages?db=${encode(db)}&schema=${encode(schema)}`
      );
      setFileLocations(list);
      setFilesByLocation({});
    } catch (err) {
      console.error('Error loading stages:', err);
      setFileLocations([]);
      setFilesByLocation({});
    }
  };

  const fetchFiles = async (db: string, schema: string, stage: string) => {
    try {
      const list = await getList(
        `${API_BASE}/api/stage-files?db=${encode(db)}&schema=${encode(schema)}&stage=${encode(stage)}`
      );
      setFilesByLocation((prev) => ({ ...prev, [stage]: list }));
    } catch (err) {
      console.error('Error loading files:', err);
      setFilesByLocation((prev) => ({ ...prev, [stage]: [] }));
    }
  };

  // Talk-to-Document: tables / columns
  const fetchTables = async (db: string, schema: string) => {
    try {
      const list = await getList(
        `${API_BASE}/api/tables?db=${encode(db)}&schema=${encode(schema)}`
      );
      setTables(list);
      setColumnsByTable({});
    } catch (err) {
      console.error('Error loading tables:', err);
      setTables([]);
      setColumnsByTable({});
    }
  };

  const fetchColumns = async (db: string, schema: string, table: string) => {
    try {
      const list = await getList(
        `${API_BASE}/api/columns?db=${encode(db)}&schema=${encode(schema)}&table=${encode(table)}`
      );
      setColumnsByTable((prev) => ({ ...prev, [table]: list }));
    } catch (err) {
      console.error('Error loading columns:', err);
      setColumnsByTable((prev) => ({ ...prev, [table]: [] }));
    }
  };

  // Talk-to-Data: semantic views / models
  const fetchSemanticViews = async (db: string, schema: string) => {
    try {
      const list = await getList(
        `${API_BASE}/api/semantic-views?db=${encode(db)}&schema=${encode(schema)}`
      );
      setSemanticViews(list);
    } catch (err) {
      console.error('Error loading semantic views:', err);
      setSemanticViews([]);
    }
  };

  const fetchSemanticModels = async (db: string, schema: string) => {
    try {
      const list = await getList(
        `${API_BASE}/api/semantic-models?db=${encode(db)}&schema=${encode(schema)}`
      );
      setSemanticModels(list);
    } catch (err) {
      console.error('Error loading semantic models:', err);
      setSemanticModels([]);
    }
  };

  const handleSubmit = (data: PipelineFormData) => {
    navigate('/review-pipeline', {
      state: { ...data, mode: 'create' },
    });
  };

  return (
    <div className={styles.graywrapper}>
      <h3 className={styles.wrappertitle}>Application</h3>
      <p className={styles.wrapperdesc}>{getModeDisplay(mode)} / Data Preparation</p>

      <div className={styles.contentWrapper}>
        <div className={styles.formWrapper}>
          <PipelineForm
            onSubmit={handleSubmit}
            onBack={() => navigate('/data-preparation')}
            databases={databases}
            schemasByDb={schemasByDb}
            fileLocations={fileLocations}
            filesByLocation={filesByLocation}
            tables={tables}
            columnsByTable={columnsByTable}
            fetchTables={fetchTables}
            fetchColumns={fetchColumns}
            semanticViews={semanticViews}
            semanticModels={semanticModels}
            fetchSemanticViews={fetchSemanticViews}
            fetchSemanticModels={fetchSemanticModels}
            chunkingMethodOptions={chunkingMethodOptions}
            fetchSchemas={fetchSchemas}
            fetchStages={fetchStages}
            fetchFiles={fetchFiles}
            checkPipelineNameExists={PipelineAPI.checkPipelineNameExists}
            mode="create"
          />
        </div>
      </div>
    </div>
  );
};

export default CreatePipeline;
