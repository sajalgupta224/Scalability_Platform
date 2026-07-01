import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, LinearProgress, Typography } from '@mui/material';
import {
  AccountTree,
  CloudQueue,
  Folder,
  Loop,
  PictureAsPdf,
  Schema,
  Storage,
  TableRows,
  ViewStream,
} from '@mui/icons-material';
import SuccessDialog from '../../components/ui/SuccessDialog/SuccessDialog';
import styles from './ReviewPipeline.module.scss';
import { ROUTES } from '../../constants';
import { useAppContext } from '../../context/AppContext';
import { PipelineAPI } from '../../api/endpoints/pipeline.api';
import type { PipelineFormData } from '../../types/dataPreparation';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
const DEFAULT_STREAM = 'R_PIPELINE_STREAM';

type CreateSearchResp = {
  ok?: boolean;
  message?: string;
  error?: string;
  detail?: string;
  serviceName?: string;
};

type ChunkingResp = {
  success: boolean;
  message: string;
  tables: string[];
  serviceName?: string; // ✅ returned by run-chunking
  error?: string;
};

const ReviewPipeline: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser } = useAppContext();

  const state =
    (location.state as PipelineFormData & {
      mode?: 'create' | 'edit';
      id?: string;
      stream?: string;
    }) || {};

  const { mode = 'create', id, ...formData } = state;

  const [showSuccess, setShowSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [stepMsg, setStepMsg] = useState('');
  const [stepProgress, setStepProgress] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

  // ---------- Database config ----------
  const selectedTables: string[] = (formData as any).selectedTables ?? [];
  const tableConfigs = (formData as any).tableConfigs ?? {};

  const firstTable = selectedTables[0] || null;
  const firstCfg = firstTable ? tableConfigs[firstTable] : null;
  const firstTextColumn = firstCfg?.textColumn || null;
  const firstRowFilter = firstCfg?.filter || null;

  // ---------- Helpers ----------
  const sanitizeIdent = (s: string) =>
    (s || '')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '');

  const postJson = async <T,>(url: string, payload: any): Promise<T> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data?.detail || data?.message || data?.error || `HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data as T;
  };

  // ---------- Back navigation (fixed) ----------
  const handleBack = () => {
    // If we're in edit mode and have an id, go back to the edit route for that pipeline
    if (mode === 'edit' && id) {
      navigate(`${ROUTES.EDIT_PIPELINE}/${id}`, {
        state: {
          ...formData,
          mode: 'edit',
          id,
        },
        replace: true, // optional: keep history clean in multi-step flows
      });
      return;
    }

    // Default: go back to the create flow with current form state
    navigate(ROUTES.CREATE_PIPELINE, { state: formData });
  };

  // ---------- Submit orchestrator ----------
  const handleSubmit = async () => {
    setSubmitting(true);
    setStepError(null);
    setStepMsg('');
    setStepProgress(0);

    try {
      if (!formData.dataSourceType) throw new Error('dataSourceType is missing');

      // ========= DATABASE =========
      if (formData.dataSourceType === 'database' && firstTable && firstTextColumn) {
        // 1) Create Cortex Search Service (DATABASE ONLY ✅)
        setStepMsg('Creating Cortex Search Service...');
        setStepProgress(20);

        const explicitServiceName = `${sanitizeIdent(
          formData.pipelineName
        )}_CSVC_${sanitizeIdent(firstTable)}`;

        const cortexResp = await postJson<CreateSearchResp>(
          `${API_BASE}/api/create-search-service`,
          {
            db: formData.selectedDb,
            schema: formData.selectedSchema,
            table: firstTable,
            textColumn: firstTextColumn,
            attributeColumns: firstCfg?.attributeColumns ?? [],
            name: formData.pipelineName,
            serviceName: explicitServiceName,
            filter: firstRowFilter ?? '',
          }
        );

        if (cortexResp?.ok !== true)
          throw new Error(
            cortexResp?.detail || cortexResp?.error || cortexResp?.message || 'Cortex create failed'
          );

        const finalServiceName = cortexResp.serviceName || explicitServiceName;

        // 2) Submit pipeline
        setStepMsg('Submitting pipeline...');
        setStepProgress(70);

        const submitPayload: any = {
          pipelineName: formData.pipelineName,
          dataSourceType: 'database',
          selectedDb: formData.selectedDb,
          selectedSchema: formData.selectedSchema,
          tableName: firstTable,
          columnName: firstTextColumn,
          rowFilter: firstRowFilter ?? null,
          cortexSearchService: finalServiceName,
          semanticView: null,
          semanticModel: null,
          userId: currentUser?.USERID || null,
        };

        if (mode === 'edit' && id) {
          await PipelineAPI.updatePipeline({
            ...submitPayload,
            pipelineId: id,
          });
        } else {
          await PipelineAPI.submitPipeline(submitPayload);
        }

        setStepProgress(100);
        setShowSuccess(true);
        return;
      }

      // ========= CLOUD =========
      if (formData.dataSourceType === 'cloud') {
        // 1) Run Chunking (creates chunk table + search service ✅)
        setStepMsg('Running chunking...');
        setStepProgress(30);

        const chunkResp = await postJson<ChunkingResp>(`${API_BASE}/api/run-chunking`, {
          db: formData.selectedDb,
          schema: formData.selectedSchema,
          stage: formData.fileLocation,
          fileNames: formData.selectedFiles && formData.selectedFiles.length > 0
            ? formData.selectedFiles
            : [],
          chunkMethod: formData.chunkingMethod,
          chunkSize: formData.chunkSize ?? 1000,
          chunkOverlap: formData.chunkOverlap ?? 0,
          pipelineName: formData.pipelineName,
        });

        if (chunkResp?.success !== true)
          throw new Error(chunkResp?.error || chunkResp?.message || 'Chunking failed');

        const chunkTable = chunkResp.tables && chunkResp.tables.length ? chunkResp.tables[0] : null;

        if (!chunkTable) throw new Error('Chunking succeeded but no chunk table returned');

        const searchServiceName = chunkResp.serviceName;
        if (!searchServiceName)
          throw new Error('Chunking did not return cortex search service name');

        // 2) Submit pipeline (NO create-search-service here ✅)
        setStepMsg('Submitting pipeline...');
        setStepProgress(80);

        const submitPayload: any = {
          pipelineName: formData.pipelineName,
          dataSourceType: 'cloud',
          selectedDb: formData.selectedDb,
          selectedSchema: formData.selectedSchema,
          fileLocation: formData.fileLocation,
          selectedFiles: formData.selectedFiles,
          chunkingMethod: formData.chunkingMethod,
          chunkSize: formData.chunkSize,
          chunkOverlap: formData.chunkOverlap,
          chunkTable: chunkTable,
          cortexSearchService: searchServiceName,
          stream: (formData as any).stream || DEFAULT_STREAM,
          userId: currentUser?.USERID || null,
        };

        if (mode === 'edit' && id) {
          await PipelineAPI.updatePipeline({
            ...submitPayload,
            pipelineId: id,
          });
        } else {
          await PipelineAPI.submitPipeline(submitPayload);
        }

        setStepProgress(100);
        setShowSuccess(true);
        return;
      }

      // ========= ANALYST =========
      setStepMsg('Submitting pipeline...');
      setStepProgress(70);

      const submitPayload: any = {
        pipelineName: formData.pipelineName,
        dataSourceType: 'database',
        selectedDb: formData.selectedDb,
        selectedSchema: formData.selectedSchema,
        semanticView: (formData as any).semanticView || null,
        semanticModel: (formData as any).semanticModel || null,
        userId: currentUser?.USERID || null,
      };

      if (mode === 'edit' && id) {
        await PipelineAPI.updatePipeline({
          ...submitPayload,
          pipelineId: id,
        });
      } else {
        await PipelineAPI.submitPipeline(submitPayload);
      }

      setStepProgress(100);
      setShowSuccess(true);
    } catch (e: any) {
      setStepError(e?.message || String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    navigate(ROUTES.DATA_PREPARATION);
  };

  // ---------- Review UI ----------
  const commonReviewItems = useMemo(
    () => [
      { label: 'Category', value: 'Data Entry', icon: <ViewStream /> },
      {
        label: 'Data pipeline name',
        value: formData.pipelineName || '-',
        icon: <AccountTree />,
      },
      {
        label: 'File source type',
        value: formData.dataSourceType || '-',
        icon: <CloudQueue />,
      },
    ],
    [formData]
  );

  const dbReviewItems = useMemo(() => {
    if (formData.dataSourceType !== 'database') return [];

    const semanticViews: string[] = (formData as any).semanticView ?? [];
    const semanticModel: string | null = (formData as any).semanticModel ?? null;
    const hasSelectedTables = selectedTables && selectedTables.length > 0;

    const isTalkToData =
      !hasSelectedTables && ((semanticViews && semanticViews.length > 0) || !!semanticModel);

    if (isTalkToData) {
      if (semanticViews && semanticViews.length > 0) {
        const viewsDisplay = semanticViews.join(', ');
        return [
          { label: 'Database', value: formData.selectedDb || '-', icon: <Storage /> },
          { label: 'Schema', value: formData.selectedSchema || '-', icon: <Schema /> },
          {
            label: 'Semantic Option',
            value: <div>View: {viewsDisplay}</div>,
            icon: <TableRows />,
          },
        ];
      }

      const modelDisplay = semanticModel || '-';
      return [
        { label: 'Database', value: formData.selectedDb || '-', icon: <Storage /> },
        { label: 'Schema', value: formData.selectedSchema || '-', icon: <Schema /> },
        {
          label: 'Semantic Option',
          value: <div>Model: {modelDisplay}</div>,
          icon: <TableRows />,
        },
      ];
    }

    // default (non semantic) behaviour / talk-to-document
    return [
      { label: 'Database', value: formData.selectedDb || '-', icon: <Storage /> },
      { label: 'Schema', value: formData.selectedSchema || '-', icon: <Schema /> },
      {
        label: 'Table',
        value: selectedTables.length ? selectedTables.join(', ') : '-',
        icon: <TableRows />,
      },
    ];
  }, [formData, selectedTables]);

  const cloudReviewItems = useMemo(() => {
    if (formData.dataSourceType !== 'cloud') return [];
    return [
      { label: 'File location', value: formData.fileLocation || '-', icon: <Folder /> },
      { label: 'File type', value: (() => {
        const file = formData.selectedFiles?.[0];
        if (!file) return 'Document';
        const ext = String(file).split('.').pop()?.toUpperCase();
        return ext || 'Document';
      })(), icon: <PictureAsPdf /> },
      { label: 'Chunking method', value: formData.chunkingMethod || '-', icon: <TableRows /> },
      { label: 'Chunking size', value: formData.chunkSize?.toString() || '-', icon: <TableRows /> },
      {
        label: 'Chunking overlap',
        value: formData.chunkOverlap?.toString() || '-',
        icon: <Loop />,
      },
      { label: 'Stream', value: (formData as any).stream || DEFAULT_STREAM, icon: <ViewStream /> },
    ];
  }, [formData]);

  const reviewItems = [...commonReviewItems, ...cloudReviewItems, ...dbReviewItems];

  return (
    <>
      <div className={styles.pageContainer}>
        <Typography variant="h4" className={styles.pageTitle}>
          Review your pipeline
        </Typography>

        <div className={styles.outerCard}>
          <div className={styles.innerCard}>
            <div className={styles.reviewList}>
              {reviewItems.map((item, index) => (
                <div key={index} className={styles.reviewRow}>
                  <div className={styles.labelColumn}>
                    <Typography variant="body2" className={styles.label}>
                      {item.label}
                    </Typography>
                  </div>
                  <div className={styles.valueColumn}>
                    <div className={styles.iconWrapper}>{item.icon}</div>
                    <Typography variant="body1" className={styles.value}>
                      {item.value}
                    </Typography>
                  </div>
                </div>
              ))}
            </div>

            {submitting && (
              <Box sx={{ mt: 2 }}>
                <Typography>{stepMsg}</Typography>
                <LinearProgress variant="determinate" value={stepProgress} />
              </Box>
            )}

            {stepError && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                {stepError}
              </Alert>
            )}
          </div>

          <div className={styles.buttonContainer}>
            <Button
              variant="outlined"
              className={styles.backButton}
              onClick={handleBack}
              disabled={submitting}
            >
              Back
            </Button>

            <Button
              variant="contained"
              className={styles.submitButton}
              onClick={handleSubmit}
              disabled={submitting}
            >
              {mode === 'edit' && id ? 'Update' : 'Submit'}
            </Button>
          </div>
        </div>
      </div>

      <SuccessDialog
        open={showSuccess}
        onClose={handleSuccessClose}
        message={mode === 'edit' ? 'Pipeline updated' : 'Pipeline submitted'}
        subMessage={
          mode === 'edit'
            ? 'Your pipeline has been updated successfully'
            : 'Your pipeline has been created successfully'
        }
      />
    </>
  );
};

export default ReviewPipeline;