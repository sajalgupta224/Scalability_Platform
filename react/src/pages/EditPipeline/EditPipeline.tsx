
import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import PipelineForm from '../../components/ui/PipelineForm/PipelineForm';
import type { PipelineFormData } from '../../types/dataPreparation';
import type { SchemasByDb, FilesByLocation } from '../../types/pages.types';
import { PipelineAPI } from '../../api/endpoints/pipeline.api';
import styles from '../EditPipeline/EditPipeline.module.scss';
import { getModeDisplay } from '../Application/Application';
import { useAppContext } from '../../context/AppContext';

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

const EditPipeline: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { mode } = useAppContext();

  const [databases, setDatabases] = useState<string[]>([]);
  const [schemasByDb, setSchemasByDb] = useState<SchemasByDb>({});
  const [fileLocations, setFileLocations] = useState<string[]>([]);
  const [filesByLocation, setFilesByLocation] = useState<FilesByLocation>({});

  // Talk-to-Document
  const [tables, setTables] = useState<string[]>([]);
  const [columnsByTable, setColumnsByTable] = useState<Record<string, string[]>>({});

  // Talk-to-Data
  const [semanticViews, setSemanticViews] = useState<string[]>([]);
  const [semanticModels, setSemanticModels] = useState<string[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<PipelineFormData | null>(null);

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
    } catch (err) {
      console.error('Error loading schemas:', err);
      setSchemasByDb((prev) => ({ ...prev, [db]: [] }));
    }
  };

  const fetchStages = async (db: string, schema: string) => {
    try {
      const list = await getList(
        `${API_BASE}/api/stages?db=${encode(db)}&schema=${encode(schema)}`
      );
      setFileLocations(list);
    } catch (err) {
      console.error('Error loading stages:', err);
      setFileLocations([]);
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

  // Talk-to-Document fetch
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

  // Talk-to-Data fetch
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

  useEffect(() => {
    const fetchPipelineConfiguration = async () => {
      if (!id) {
        setError('Pipeline ID is missing');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const pipelineData: any = await PipelineAPI.getPipelineById(id);

        const formData: PipelineFormData = {
          pipelineId: pipelineData.PIPELINE_ID || id || null,

          pipelineName: pipelineData.PIPELINE_NAME || '',
          dataSourceType:
            (pipelineData.FILE_SOURCE_TYPE?.toLowerCase() as 'cloud' | 'database') || null,

          selectedDb: pipelineData.DATABASE || null,
          selectedSchema: pipelineData.SCHEMA || null,

          fileLocation: pipelineData.FILE_LOCATION || null,
          selectedFiles: pipelineData.FILE_TYPE
            ? String(pipelineData.FILE_TYPE)
                .split(',')
                .map((x: string) => x.trim())
                .filter(Boolean)
            : [],
          chunkingMethod: pipelineData.CHUNKING_METHOD || null,
          chunkSize: pipelineData.CHUNK_SIZE ? Number(pipelineData.CHUNK_SIZE) : null,
          chunkOverlap: pipelineData.CHUNK_OVERLAP ? Number(pipelineData.CHUNK_OVERLAP) : null,

          semanticView:
            pipelineData.SEMANTIC_VIEW && Array.isArray(pipelineData.SEMANTIC_VIEW)
              ? pipelineData.SEMANTIC_VIEW
              : [],
          semanticModel: pipelineData.SEMANTIC_MODEL || null,

          selectedTables: pipelineData.SELECTED_TABLES || [],
          tableConfigs: pipelineData.TABLE_CONFIGS || {},
          createdSearchServices: pipelineData.CREATED_SEARCH_SERVICES || {},
        } as any;

        setInitialData(formData);

        // Prefetch dependent data
        if (formData.selectedDb) {
          await fetchSchemas(formData.selectedDb);

          if (formData.selectedSchema) {
            await fetchStages(formData.selectedDb, formData.selectedSchema);

            await fetchTables(formData.selectedDb, formData.selectedSchema);
            await fetchSemanticViews(formData.selectedDb, formData.selectedSchema);
            await fetchSemanticModels(formData.selectedDb, formData.selectedSchema);

            const selectedTables = (formData as any).selectedTables ?? [];
            for (const t of selectedTables) {
              await fetchColumns(formData.selectedDb, formData.selectedSchema, t);
            }

            if (formData.fileLocation) {
              await fetchFiles(formData.selectedDb, formData.selectedSchema, formData.fileLocation);
            }
          }
        }
      } catch (err) {
        console.error('Error fetching pipeline configuration:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchPipelineConfiguration();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleSubmit = (data: PipelineFormData) => {
    navigate('/review-pipeline', {
      state: { ...data, id, mode: 'edit' },
    });
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
        }}
      >
        <CircularProgress />
        <Typography variant="body1" sx={{ marginLeft: 2 }}>
          Loading pipeline configuration...
        </Typography>
      </Box>
    );
  }

  if (error || !initialData) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
        }}
      >
        <Typography variant="h6" color="error">
          {error || 'Failed to load pipeline configuration'}
        </Typography>
      </Box>
    );
  }

  return (
    <div className={styles.graywrapper}>
      <h3 className={styles.wrappertitle}>Application</h3>
      <p className={styles.wrapperdesc}>{getModeDisplay(mode)} / Data Preparation</p>

      <Box sx={{ padding: '40px' }}>
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
          initialData={initialData}
          mode="edit"
        />
      </Box>
    </div>
  );
};

export default EditPipeline;
