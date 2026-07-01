import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
  InputAdornment,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import SchemaOutlinedIcon from '@mui/icons-material/SchemaOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import TagIcon from '@mui/icons-material/Tag';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';

import FileSourceSelector from '../FileSourceSelector/FileSourceSelector';
import Dropdown from '../Dropdown/Dropdown';

import styles from './PipelineForm.module.scss';

import type { DropdownOption } from '../../../types/ui.types';
import type { FileSourceType, FormErrors, PipelineFormData } from '../../../types/dataPreparation';
import { useAppContext } from '../../../context/AppContext';
import { PipelineAPI } from '../../../api/endpoints/pipeline.api';

type TableConfig = {
  textColumn: string | null;
  attributeColumns: string[];
};

interface PipelineFormProps {
  onSubmit: (data: PipelineFormData) => void;
  onBack: () => void;

  databases: string[];
  schemasByDb: Record<string, string[]>;

  fileLocations: string[];
  filesByLocation: Record<string, string[]>;

  tables?: string[];
  columnsByTable?: Record<string, string[]>;
  fetchTables?: (db: string, schema: string) => Promise<void>;
  fetchColumns?: (db: string, schema: string, table: string) => Promise<void>;

  semanticViews?: string[];
  semanticModels?: string[];
  fetchSemanticViews?: (db: string, schema: string) => Promise<void>;
  fetchSemanticModels?: (db: string, schema: string) => Promise<void>;

  chunkingMethodOptions: { value: string; label: string }[];
  fetchSchemas: (db: string) => Promise<void>;
  fetchStages: (db: string, schema: string) => Promise<void>;
  fetchFiles: (db: string, schema: string, stage: string) => Promise<void>;

  checkPipelineNameExists: (pipelineName: string, pipelineId?: string | number) => Promise<boolean>;

  initialData?: PipelineFormData;
  mode?: 'create' | 'edit';
}

const createDefaultFormData = (): PipelineFormData =>
  ({
    pipelineName: '',
    dataSourceType: null,
    selectedDb: null,
    selectedSchema: null,

    fileLocation: null,
    selectedFiles: [],
    chunkingMethod: null,
    chunkSize: null,
    chunkOverlap: null,

    semanticView: [],
    semanticModel: null,

    selectedTables: [],
    tableConfigs: {},
    createdSearchServices: {},
  }) as any;

const PipelineForm: React.FC<PipelineFormProps> = ({
  onSubmit,
  onBack,
  databases,
  schemasByDb,
  fileLocations,
  filesByLocation,

  tables = [],
  columnsByTable = {},
  fetchTables,
  fetchColumns,

  semanticViews = [],
  semanticModels = [],
  fetchSemanticViews,
  fetchSemanticModels,

  chunkingMethodOptions,
  fetchSchemas,
  fetchStages,
  fetchFiles,

  checkPipelineNameExists,
  initialData,
  mode = 'create',
}) => {
  const { mode: appMode } = useAppContext();

  const isTalkToDocument = String(appMode || '')
    .toLowerCase()
    .includes('document');
  const isTalkToData = !isTalkToDocument;

  const [formData, setFormData] = useState<PipelineFormData>(
    initialData || createDefaultFormData()
  );

  const [errors, setErrors] = useState<FormErrors>({});
  const [pipelineNameError, setPipelineNameError] = useState<string>('');
  const [banner, setBanner] = useState<{
    show: boolean;
    severity: 'success' | 'warning';
    message: string;
  }>({
    show: false,
    severity: 'success',
    message: '',
  });

  const [pipelineNameTouched, setPipelineNameTouched] = useState(false);
  const [isCheckingPipelineName, setIsCheckingPipelineName] = useState(false);

  type DocSelectionMode = 'existing' | 'upload';
  const [docSelectionMode, setDocSelectionMode] = useState<DocSelectionMode>('existing');
  const [uploadDocError, setUploadDocError] = useState('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  const docInputRef = useRef<HTMLInputElement>(null);
  const validationRequestRef = useRef(0);

  useEffect(() => {
    setFormData(initialData || createDefaultFormData());
  }, [initialData]);

  const currentPipelineId =
    (initialData as any)?.pipelineId ??
    (initialData as any)?.pipeline_id ??
    (initialData as any)?.PIPELINE_ID ??
    (initialData as any)?.id ??
    null;

  const dismissBanner = () => setBanner((b) => ({ ...b, show: false }));

  const normalizeToString = (x: any) =>
    typeof x === 'string' ? x : (x?.value ?? x?.label ?? String(x));

  const normalizeName = (name: string) =>
    String(name || '')
      .trim()
      .toLowerCase();

  const originalPipelineName = normalizeName(
    (initialData as any)?.pipelineName ?? (initialData as any)?.PIPELINE_NAME ?? ''
  );

  const clearFieldError = (field: string) => {
    setErrors((prev: any) => {
      const next = { ...(prev || {}) };
      delete next[field];
      return next;
    });
  };

  const databaseOptions: DropdownOption[] = useMemo(
    () => (Array.isArray(databases) ? databases.map((db) => ({ label: db, value: db })) : []),
    [databases]
  );

  const availableSchemas = useMemo(() => {
    const schemas = formData.selectedDb ? schemasByDb[formData.selectedDb] : [];
    return Array.isArray(schemas) ? schemas : [];
  }, [formData.selectedDb, schemasByDb]);

  const schemaOptions: DropdownOption[] = useMemo(
    () => availableSchemas.map((schema) => ({ label: schema, value: schema })),
    [availableSchemas]
  );

  const fileLocationOptions: DropdownOption[] = useMemo(
    () =>
      (Array.isArray(fileLocations) ? fileLocations : []).map((loc) => ({
        label: loc,
        value: loc,
      })),
    [fileLocations]
  );

  const stageOptions: DropdownOption[] = useMemo(
    () => (Array.isArray(fileLocations) ? fileLocations : []).map((s) => ({ label: s, value: s })),
    [fileLocations]
  );

  const tableOptions: DropdownOption[] = useMemo(
    () => (tables ?? []).map((t) => ({ label: t, value: t })),
    [tables]
  );

  const semanticViewOptions: DropdownOption[] = useMemo(
    () => (semanticViews ?? []).map((v) => ({ label: v, value: v })),
    [semanticViews]
  );

  const semanticModelOptions: DropdownOption[] = useMemo(
    () => (semanticModels ?? []).map((m) => ({ label: m, value: m })),
    [semanticModels]
  );

  const availableFilesAll = useMemo(() => {
    const files = formData.fileLocation ? filesByLocation[formData.fileLocation] : [];
    return Array.isArray(files) ? files : [];
  }, [formData.fileLocation, filesByLocation]);

  const existingDocOptions: DropdownOption[] = useMemo(
    () => availableFilesAll.map((f) => ({ label: f, value: f })),
    [availableFilesAll]
  );

  // Keep selectedFiles clean if file location changes and selected existing documents are no longer valid
  useEffect(() => {
    if (docSelectionMode !== 'existing') return;

    const selectedFiles = formData.selectedFiles ?? [];
    if (selectedFiles.length === 0) return;

    const validFiles = selectedFiles.filter((file) =>
      existingDocOptions.some((opt) => opt.value === file)
    );

    if (validFiles.length !== selectedFiles.length) {
      setFormData((prev) => ({
        ...prev,
        selectedFiles: validFiles,
      }));
    }
  }, [existingDocOptions, docSelectionMode, formData.selectedFiles]);

  const validatePipelineNameField = async (
    name: string,
    options?: { showRequired?: boolean; updateState?: boolean }
  ): Promise<{ isValid: boolean; message?: string }> => {
    const { showRequired = false, updateState = true } = options || {};
    const trimmed = String(name || '').trim();

    if (!trimmed) {
      const message = showRequired ? 'Pipeline name is required' : '';

      if (updateState) {
        setIsCheckingPipelineName(false);
        setPipelineNameError(message);
      }

      return { isValid: !message, message: message || undefined };
    }

    // edit mode: unchanged name should not show duplicate
    if (mode === 'edit' && normalizeName(trimmed) === originalPipelineName) {
      if (updateState) {
        setIsCheckingPipelineName(false);
        setPipelineNameError('');
      }
      return { isValid: true };
    }

    const requestId = ++validationRequestRef.current;

    try {
      if (updateState) setIsCheckingPipelineName(true);

      const exists = await checkPipelineNameExists(trimmed, currentPipelineId);

      console.log('[PipelineForm] duplicate check result:', {
        name: trimmed,
        exists,
      });

      if (requestId !== validationRequestRef.current) {
        return { isValid: true };
      }

      const message = exists ? 'Pipeline name already exists' : '';

      if (updateState) {
        setPipelineNameError(message);
      }

      return { isValid: !exists, message: message || undefined };
    } catch (err) {
      if (requestId !== validationRequestRef.current) {
        return { isValid: true };
      }

      const message = 'Unable to validate pipeline name. Please try again.';

      if (updateState) {
        setPipelineNameError(message);
        setBanner({
          show: true,
          severity: 'warning',
          message: 'Could not validate pipeline name right now.',
        });
      }

      return { isValid: false, message };
    } finally {
      if (requestId === validationRequestRef.current && updateState) {
        setIsCheckingPipelineName(false);
      }
    }
  };

  useEffect(() => {
    const currentName = formData.pipelineName ?? '';
    const trimmed = String(currentName).trim();

    if (!trimmed) {
      setIsCheckingPipelineName(false);
      setPipelineNameError('');
      return;
    }

    const timer = setTimeout(() => {
      void validatePipelineNameField(currentName, {
        showRequired: false,
        updateState: true,
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [formData.pipelineName]);

  const validateForm = async (): Promise<boolean> => {
    const newErrors: any = {};
    let localPipelineNameError = '';

    const pipelineValidation = await validatePipelineNameField(formData.pipelineName ?? '', {
      showRequired: true,
      updateState: false,
    });

    if (!pipelineValidation.isValid) {
      localPipelineNameError = pipelineValidation.message || '';
    }

    if (!formData.dataSourceType) {
      newErrors.sourceType = 'Please select a file source type';
    }

    if (formData.dataSourceType) {
      if (!formData.selectedDb) newErrors.database = 'Please select a database';
      if (!formData.selectedSchema) newErrors.schema = 'Please select a schema';
    }

    if (formData.dataSourceType === 'cloud') {
      if (!formData.fileLocation) newErrors.fileLocation = 'Please choose a file location';
      if (!formData.chunkingMethod) newErrors.chunkingMethod = 'Chunking method is required';
      if (!formData.chunkSize || formData.chunkSize <= 0) {
        newErrors.chunkSize = 'Chunk size must be positive';
      }
      if (formData.chunkOverlap == null || formData.chunkOverlap < 0) {
        newErrors.chunkOverlap = 'Chunk overlap cannot be negative';
      }
    }

    if (formData.dataSourceType === 'database') {
      if (isTalkToDocument) {
        const selectedTables: string[] = (formData as any).selectedTables ?? [];

        if (!selectedTables.length) {
          newErrors.selectedTables = 'Please select at least one table';
        }

        const cfgs: Record<string, TableConfig> = (formData as any).tableConfigs ?? {};
        const perTableErrors: Record<string, { textColumn?: string }> = {};

        for (const t of selectedTables) {
          if (!cfgs[t]?.textColumn) {
            perTableErrors[t] = { textColumn: 'Text column is required for this table' };
          }
        }

        if (Object.keys(perTableErrors).length) {
          newErrors.tableConfigs = perTableErrors;
        }
      } else {
        const hasView =
          Array.isArray((formData as any).semanticView) &&
          (formData as any).semanticView.length > 0;
        const hasModel = !!(formData as any).semanticModel;

        if (!hasView && !hasModel) {
          newErrors.semanticView = 'Please select one semantic option (View or Model)';
          newErrors.semanticModel = 'Please select one semantic option (View or Model)';
        } else if (hasView && hasModel) {
          newErrors.semanticView = 'Please select only one semantic option - clear the other';
          newErrors.semanticModel = 'Please select only one semantic option - clear the other';
        }
      }
    }

    setErrors(newErrors as FormErrors);
    setPipelineNameError(localPipelineNameError);

    return Object.keys(newErrors).length === 0 && !localPipelineNameError;
  };

  const handleDocUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadDocError('');

    const validFiles: File[] = [];
    const invalidNames: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isSupportedDoc =
        /\.(pdf|docx?|txt)$/i.test(file.name) ||
        file.type === 'application/pdf' ||
        file.type === 'application/msword' ||
        file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.type === 'text/plain';

      if (isSupportedDoc) {
        validFiles.push(file);
      } else {
        invalidNames.push(file.name);
      }
    }

    if (validFiles.length === 0) {
      setUploadDocError('Please upload valid files (PDF, DOC, DOCX, or TXT)');
      event.target.value = '';
      return;
    }

    try {
      setIsUploadingDoc(true);

      const uploadedNames: string[] = [];
      const failedNames: string[] = [];

      for (const file of validFiles) {
        try {
          const response = await PipelineAPI.uploadDocument(
            file,
            formData.selectedDb as string,
            formData.selectedSchema as string,
            formData.fileLocation as string
          );
          uploadedNames.push(response.file_name || file.name);
        } catch (uploadErr: any) {
          failedNames.push(`${file.name} (${uploadErr?.message || 'unknown error'})`);
        }
      }

      if (uploadedNames.length > 0) {
        setDocSelectionMode('upload');
        setFormData((prev) => ({
          ...prev,
          selectedFiles: [...(prev.selectedFiles ?? []), ...uploadedNames],
        }));

        // Refresh the stage file list so uploaded files appear in "Existing Documents"
        if (fetchFiles && formData.selectedDb && formData.selectedSchema && formData.fileLocation) {
          await fetchFiles(
            formData.selectedDb as string,
            formData.selectedSchema as string,
            formData.fileLocation as string
          );
        }

        const successMsg =
          uploadedNames.length === 1
            ? `${uploadedNames[0]} uploaded successfully.`
            : `${uploadedNames.length} files uploaded successfully.`;

        setBanner({ show: true, severity: 'success', message: successMsg });
      }

      if (failedNames.length > 0) {
        const failMsg = `Failed to upload: ${failedNames.join(', ')}`;
        setUploadDocError(failMsg);
      }

      if (invalidNames.length > 0) {
        const warnMsg = `Skipped unsupported files: ${invalidNames.join(', ')}`;
        setUploadDocError((prev) => (prev ? `${prev}. ${warnMsg}` : warnMsg));
      }
    } catch (error: any) {
      const message = error?.message || 'Failed to upload documents';
      setUploadDocError(message);
      setBanner({ show: true, severity: 'warning', message });
    } finally {
      setIsUploadingDoc(false);
      event.target.value = '';
    }
  };

  const handleNext = async () => {
    setPipelineNameTouched(true);
    const isValid = await validateForm();
    if (!isValid) return;
    onSubmit(formData);
  };

  const isNextDisabled =
    isCheckingPipelineName || pipelineNameError === 'Pipeline name already exists';

  return (
    <Box className={styles.formCard}>
      <Box className={styles.formHeader}>
        <Box className={styles.formHeaderIcon}>
          <AccountTreeOutlinedIcon />
        </Box>
        <Box>
          <Typography className={styles.formTitle}>
            {mode === 'edit' ? 'Edit data pipeline' : 'Create new data pipeline'}
          </Typography>
          <Typography className={styles.formSubtitle}>
            Configure your pipeline source and ingestion settings
          </Typography>
        </Box>
      </Box>

      {banner.show && (
        <Alert
          variant="outlined"
          severity={banner.severity}
          sx={{ mb: 2 }}
          action={
            <IconButton color="inherit" size="small" onClick={dismissBanner}>
              <CloseIcon />
            </IconButton>
          }
        >
          {banner.message}
        </Alert>
      )}

      {/* Pipeline Name */}
      <Box className={styles.pipelineNameWrapper}>
        <Typography className={styles.fieldLabel}>Pipeline name *</Typography>
        <TextField
          fullWidth
          placeholder="Enter new data pipeline name"
          value={formData.pipelineName ?? ''}
          onChange={(e) => {
            const value = e.target.value;
            setFormData((prev) => ({ ...prev, pipelineName: value }));

            // clear only required error while typing
            if (pipelineNameError === 'Pipeline name is required') {
              setPipelineNameError('');
            }
          }}
          onBlur={() => {
            setPipelineNameTouched(true);
            void validatePipelineNameField(formData.pipelineName ?? '', {
              showRequired: true,
              updateState: true,
            });
          }}
          error={!!pipelineNameError}
          helperText={
            pipelineNameError
              ? pipelineNameError
              : isCheckingPipelineName
                ? 'Checking pipeline name...'
                : 'Give your pipeline a clear and descriptive name.'
          }
          spellCheck={false}
          autoComplete="off"
        />
        <Tooltip title="Give your data pipeline a unique name" arrow placement="right">
          <IconButton size="small" sx={{ position: 'absolute', right: -40, top: 8 }}>
            <HelpOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Source Selector */}
      <FileSourceSelector
        value={formData.dataSourceType as FileSourceType}
        onChange={(v: FileSourceType) => {
          setFormData((prev) => ({ ...prev, dataSourceType: v }));
          clearFieldError('sourceType');
        }}
        error={(errors as any).sourceType}
      />

      {/* DB + Schema */}
      {formData.dataSourceType && (
        <>
        <hr className={styles.sectionDivider} />
        <Typography className={styles.sectionHeading}>Database details</Typography>
        <Box className={styles.fieldRow} sx={{ marginTop: 0 }}>
          <Box className={styles.fieldColumn}>
            <Dropdown
              label="Select Database*"
              options={databaseOptions}
              value={formData.selectedDb ?? ''}
              searchable
              startIcon={<StorageOutlinedIcon fontSize="small" sx={{ color: '#999' }} />}
              onChange={(db) => {
                setFormData((prev: any) => ({
                  ...prev,
                  selectedDb: db,
                  selectedSchema: null,
                  fileLocation: null,
                  stage: null,
                  selectedFiles: [],
                  semanticView: [],
                  semanticModel: null,
                  selectedTables: [],
                  tableConfigs: {},
                  createdSearchServices: {},
                }));

                clearFieldError('database');
                clearFieldError('schema');

                void fetchSchemas(db);
              }}
              placeholder="Choose database"
            />
            {!!(errors as any).database && (
              <Typography sx={{ color: '#d32f2f', fontSize: '12px', mt: 0.5 }}>
                {(errors as any).database}
              </Typography>
            )}
          </Box>

          <Box sx={{ flex: 1 }}>
            <Dropdown
              label="Select Schema*"
              options={schemaOptions}
              value={formData.selectedSchema ?? ''}
              searchable
              startIcon={<SchemaOutlinedIcon fontSize="small" sx={{ color: '#999' }} />}
              onChange={async (schemaVal) => {
                const db = formData.selectedDb as string;

                setFormData((prev: any) => ({
                  ...prev,
                  selectedSchema: schemaVal,
                  fileLocation: null,
                  stage: null,
                  selectedFiles: [],
                  semanticView: [],
                  semanticModel: null,
                  selectedTables: [],
                  tableConfigs: {},
                  createdSearchServices: {},
                }));

                clearFieldError('schema');

                await fetchStages(db, schemaVal);

                if (formData.dataSourceType === 'database') {
                  if (isTalkToDocument) {
                    if (fetchTables) await fetchTables(db, schemaVal);
                  } else {
                    if (fetchSemanticViews) await fetchSemanticViews(db, schemaVal);
                    if (fetchSemanticModels) await fetchSemanticModels(db, schemaVal);
                  }
                }
              }}
              placeholder="Choose schema"
            />
            {!!(errors as any).schema && (
              <Typography sx={{ color: '#d32f2f', fontSize: '12px', mt: 0.5 }}>
                {(errors as any).schema}
              </Typography>
            )}
          </Box>
        </Box>
        </>
      )}

      {/* CLOUD inputs */}
      {formData.dataSourceType === 'cloud' && (
        <>
          {/* File Location — full width */}
          <Box className={styles.formSection}>
            <Dropdown
              label="File location *"
              options={fileLocationOptions}
              value={formData.fileLocation ?? ''}
              searchable
              startIcon={<FolderOutlinedIcon fontSize="small" sx={{ color: '#999' }} />}
              onChange={async (fileLocation) => {
                setFormData((prev) => ({
                  ...prev,
                  fileLocation,
                  selectedFiles: [],
                }));

                setDocSelectionMode('existing');
                setUploadDocError('');
                clearFieldError('fileLocation');

                if (fetchFiles && formData.selectedDb && formData.selectedSchema) {
                  await fetchFiles(
                    formData.selectedDb as string,
                    formData.selectedSchema as string,
                    fileLocation as string
                  );
                }
              }}
              placeholder="Choose a file location"
            />
            <Typography className={styles.helperText}>
              Select the path or folder where your source files are located.
            </Typography>
            {!!(errors as any).fileLocation && (
              <Typography className={styles.errorText}>
                {(errors as any).fileLocation}
              </Typography>
            )}
          </Box>

          {/* Document source — full width panel */}
          <Box className={styles.documentSourceWrapper}>
            <Box
              className={`${styles.documentSourcePanel} ${uploadDocError ? styles.documentSourcePanelError : ''}`}
            >
              <Typography className={styles.documentSourceLabel}>
                Document source <span className={styles.optionalText}>(optional)</span>
              </Typography>

              <Box className={styles.documentSourceRow}>
                {/* Mode selector */}
                <Box className={styles.documentSourceField}>
                  <TextField
                    select
                    fullWidth
                    label="Select document option"
                    value={docSelectionMode}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                      startAdornment: (
                        <Box component="span" sx={{ display: 'flex', mr: 0.5, color: '#999' }}>
                          <DescriptionOutlinedIcon fontSize="small" />
                        </Box>
                      ),
                    }}
                    onChange={(e) => {
                      const nextMode = e.target.value as DocSelectionMode;
                      setDocSelectionMode(nextMode);
                      setUploadDocError('');

                      if (nextMode === 'existing') {
                        const currentFiles = formData.selectedFiles ?? [];
                        const validFiles = currentFiles.filter((f) =>
                          existingDocOptions.some((opt) => opt.value === f)
                        );

                        if (validFiles.length !== currentFiles.length) {
                          setFormData((prev) => ({
                            ...prev,
                            selectedFiles: validFiles,
                          }));
                        }
                      }
                    }}
                  >
                    <MenuItem value="existing">Existing Documents</MenuItem>
                    <MenuItem value="upload">Upload Document</MenuItem>
                  </TextField>
                </Box>

                {/* Document content */}
                <Box className={styles.documentSourceField}>
                  {docSelectionMode === 'existing' ? (
                    <>
                      <Dropdown
                        label="Select Existing Documents"
                        options={existingDocOptions}
                        value={formData.selectedFiles ?? []}
                        multiple
                        searchable
                        disabled={!formData.fileLocation}
                        startIcon={<DescriptionOutlinedIcon fontSize="small" sx={{ color: '#999' }} />}
                        onChange={(selected) => {
                          const selectedDocs = Array.isArray(selected) ? selected : [selected];
                          setFormData((prev) => ({
                            ...prev,
                            selectedFiles: selectedDocs,
                          }));
                          setUploadDocError('');
                        }}
                        placeholder="Choose documents"
                      />
                      {!formData.fileLocation && (
                        <Typography variant="caption" sx={{ color: '#999', mt: 0.5, display: 'block' }}>
                          Please choose a file location first
                        </Typography>
                      )}
                      {formData.fileLocation && existingDocOptions.length === 0 && (
                        <Typography variant="caption" sx={{ color: '#999', mt: 0.5, display: 'block' }}>
                          No existing documents found in the selected location
                        </Typography>
                      )}
                    </>
                  ) : (
                    <>
                      <label
                        className={`${styles.uploadZone} ${isUploadingDoc ? styles.uploadZoneDisabled : ''} ${uploadDocError ? styles.uploadZoneError : ''}`}
                      >
                        <input
                          ref={docInputRef}
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                          style={{ display: 'none' }}
                          disabled={isUploadingDoc}
                          onChange={handleDocUpload}
                        />
                        <Box className={styles.uploadZoneContent}>
                          <DescriptionOutlinedIcon className={styles.uploadIcon} />
                          <Box>
                            <Typography className={styles.uploadFileName}>
                              {isUploadingDoc
                                ? 'Uploading documents...'
                                : (formData.selectedFiles?.length ?? 0) > 0
                                  ? formData.selectedFiles!.length === 1
                                    ? formData.selectedFiles![0]
                                    : `${formData.selectedFiles!.length} files uploaded`
                                  : 'Upload Documents'}
                            </Typography>
                            <Typography className={styles.uploadHint}>
                              {(formData.selectedFiles?.length ?? 0) > 0
                                ? 'Click to add more files'
                                : 'PDF, DOC, DOCX, TXT (multiple files supported)'}
                            </Typography>
                          </Box>
                        </Box>

                        {isUploadingDoc ? (
                          <CircularProgress size={18} />
                        ) : (
                          <CloudUploadOutlinedIcon className={styles.uploadIcon} />
                        )}
                      </label>

                      {uploadDocError && (
                        <Typography sx={{ color: '#d32f2f', fontSize: '12px', mt: 0.5 }}>
                          {uploadDocError}
                        </Typography>
                      )}

                      {(formData.selectedFiles?.length ?? 0) > 0 && !isUploadingDoc && (
                        <>
                          <Box sx={{ mt: 1, pl: 1 }}>
                            {formData.selectedFiles!.map((fileName, idx) => (
                              <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography variant="body2" sx={{ color: '#555', fontSize: '0.8rem' }}>
                                  • {fileName}
                                </Typography>
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFormData((prev) => ({
                                      ...prev,
                                      selectedFiles: prev.selectedFiles?.filter((_, i) => i !== idx) ?? [],
                                    }));
                                  }}
                                  sx={{ padding: '2px' }}
                                  title="Remove file"
                                >
                                  <DeleteOutlineIcon sx={{ fontSize: '1rem', color: '#d32f2f' }} />
                                </IconButton>
                              </Box>
                            ))}
                          </Box>
                          <Box className={styles.uploadActions}>
                            <Button
                              size="small"
                              variant="text"
                              onClick={() => {
                                if (docInputRef.current) {
                                  docInputRef.current.value = '';
                                  docInputRef.current.click();
                                }
                              }}
                            >
                              Add More Files
                            </Button>
                            <Button
                              size="small"
                              color="error"
                              variant="text"
                              onClick={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  selectedFiles: [],
                                }));
                                setUploadDocError('');
                              }}
                            >
                              Remove All
                            </Button>
                          </Box>
                        </>
                      )}
                    </>
                  )}
                </Box>
              </Box>
            </Box>
          </Box>

          <Box sx={{ mt: '20px' }}>
            <Dropdown
              label="Choose chunking method*"
              options={chunkingMethodOptions}
              value={formData.chunkingMethod ?? ''}
              onChange={(method) => {
                setFormData((prev) => ({ ...prev, chunkingMethod: method }));
                clearFieldError('chunkingMethod');
              }}
              placeholder="Select chunking method"
              optionTooltips={{
                FixedSizeChunking:
                  'Splits text into equal-sized pieces (for example, every 500 characters). Simple and fast, but may cut sentences or ideas in half.',
                RecursiveChunking:
                  'Splits text using natural boundaries like paragraphs, sentences, and words. Preserves context by keeping related ideas together.',
              }}
            />
            {!!(errors as any).chunkingMethod && (
              <Typography sx={{ color: '#d32f2f', fontSize: '12px', mt: 0.5 }}>
                {(errors as any).chunkingMethod}
              </Typography>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: '16px', mt: '20px' }}>
            <TextField
              label="Chunk size*"
              type="number"
              value={formData.chunkSize ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  chunkSize: value === '' ? null : Number(value),
                }));
                clearFieldError('chunkSize');
              }}
              error={!!(errors as any).chunkSize}
              helperText={(errors as any).chunkSize || ' '}
              sx={{ flex: 1 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip
                      title="Maximum number of characters per chunk (e.g., 500). Determines how large each piece will be."
                      arrow
                    >
                      <IconButton size="small">
                        <HelpOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Chunk overlap*"
              type="number"
              value={formData.chunkOverlap ?? ''}
              onChange={(e) => {
                const value = e.target.value;
                setFormData((prev) => ({
                  ...prev,
                  chunkOverlap: value === '' ? null : Number(value),
                }));
                clearFieldError('chunkOverlap');
              }}
              error={!!(errors as any).chunkOverlap}
              helperText={(errors as any).chunkOverlap || ' '}
              sx={{ flex: 1 }}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <Tooltip
                      title="Number of characters to overlap between consecutive chunks to preserve context."
                      arrow
                    >
                      <IconButton size="small">
                        <HelpOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </InputAdornment>
                ),
              }}
            />
          </Box>
        </>
      )}

      {/* DATABASE Talk-to-Document */}
      {formData.dataSourceType === 'database' && isTalkToDocument && (
        <>
          <Box sx={{ display: 'flex', gap: '16px', marginTop: '20px' }}>
            <Box sx={{ flex: 1 }}>
              <Dropdown
                label="Select Tables*"
                options={tableOptions}
                value={(formData as any).selectedTables ?? []}
                placeholder="Select tables"
                multiple
                onChange={async (selected) => {
                  const db = formData.selectedDb as string;
                  const schema = formData.selectedSchema as string;

                  const selectedTables = (Array.isArray(selected) ? selected : [selected]).map(
                    normalizeToString
                  );
                  const prevTables = (formData as any).selectedTables ?? [];

                  const added = selectedTables.filter((t) => !prevTables.includes(t));
                  if (fetchColumns) {
                    for (const t of added) {
                      await fetchColumns(db, schema, t);
                    }
                  }

                  setFormData((prev: any) => {
                    const nextCfg: Record<string, TableConfig> = { ...(prev.tableConfigs ?? {}) };

                    const removed = prevTables.filter((t: string) => !selectedTables.includes(t));
                    removed.forEach((t: string) => delete nextCfg[t]);

                    selectedTables.forEach((t: string) => {
                      if (!nextCfg[t]) {
                        nextCfg[t] = {
                          textColumn: null,
                          attributeColumns: [],
                        };
                      }
                    });

                    return {
                      ...prev,
                      selectedTables,
                      tableConfigs: nextCfg,
                      createdSearchServices: {},
                    };
                  });

                  clearFieldError('selectedTables');
                }}
              />
              {!!(errors as any).selectedTables && (
                <Typography sx={{ color: '#d32f2f', fontSize: '12px', mt: 0.5 }}>
                  {(errors as any).selectedTables}
                </Typography>
              )}
            </Box>
          </Box>

          {(formData as any).selectedTables?.map((table: string) => {
            const cols = columnsByTable?.[table] ?? [];
            const cfg: TableConfig = (formData as any).tableConfigs?.[table] ?? {
              textColumn: null,
              attributeColumns: [],
            };

            const colOptions: DropdownOption[] = cols.map((c) => ({ label: c, value: c }));

            return (
              <Box
                key={table}
                sx={{ mt: 2, p: 2, border: '1px solid #e5e7eb', borderRadius: '10px' }}
              >
                <Typography sx={{ fontWeight: 700, mb: 1 }}>{table}</Typography>

                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Box sx={{ flex: 1 }}>
                    <Dropdown
                      label="Select Text Column*"
                      options={colOptions}
                      value={cfg.textColumn ?? ''}
                      placeholder="Select text column"
                      onChange={(v) => {
                        const textCol = normalizeToString(v);

                        setFormData((prev: any) => ({
                          ...prev,
                          tableConfigs: {
                            ...(prev.tableConfigs ?? {}),
                            [table]: {
                              ...(prev.tableConfigs?.[table] ?? {
                                textColumn: null,
                                attributeColumns: [],
                              }),
                              textColumn: textCol,
                            },
                          },
                          createdSearchServices: {},
                        }));
                      }}
                    />

                    {!!(errors as any).tableConfigs?.[table]?.textColumn && (
                      <Typography sx={{ color: '#d32f2f', fontSize: '12px', mt: 0.5 }}>
                        {(errors as any).tableConfigs?.[table]?.textColumn}
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ flex: 1 }}>
                    <Dropdown
                      label="Select Attribute Columns (optional)"
                      options={colOptions}
                      value={cfg.attributeColumns ?? []}
                      placeholder="Select attribute columns"
                      multiple
                      onChange={(attrs) => {
                        const arr = (Array.isArray(attrs) ? attrs : [attrs]).map(normalizeToString);

                        setFormData((prev: any) => ({
                          ...prev,
                          tableConfigs: {
                            ...(prev.tableConfigs ?? {}),
                            [table]: {
                              ...(prev.tableConfigs?.[table] ?? {
                                textColumn: null,
                                attributeColumns: [],
                              }),
                              attributeColumns: arr,
                            },
                          },
                          createdSearchServices: {},
                        }));
                      }}
                    />
                  </Box>
                </Box>
              </Box>
            );
          })}
        </>
      )}

      {/* DATABASE Talk-to-Data */}
      {formData.dataSourceType === 'database' && isTalkToData && (
        <>
          <Box sx={{ display: 'flex', gap: '16px', marginTop: '20px' }}>
            <Box sx={{ flex: 1 }}>
              <Dropdown
                label="Select Stage"
                options={stageOptions}
                value={(formData as any).stage ?? ''}
                onChange={(stage) => {
                  const db = formData.selectedDb as string;
                  const schema = formData.selectedSchema as string;

                  setFormData((prev: any) => ({
                    ...prev,
                    stage,
                    semanticView: stage ? [] : (prev.semanticView ?? []),
                    semanticModel: stage ? null : (prev.semanticModel ?? null),
                  }));

                  if (fetchFiles && db && schema && stage) {
                    void fetchFiles(db, schema, stage);
                  }
                }}
                placeholder="Select stage"
              />
            </Box>
          </Box>

          <Box sx={{ display: 'flex', gap: '16px', marginTop: '20px' }}>
            <Box sx={{ flex: 1 }}>
              <Dropdown
                label="Select Semantic View*"
                options={semanticViewOptions}
                value={formData.semanticView ?? []}
                onChange={(views) =>
                  setFormData((prev) => ({
                    ...prev,
                    semanticView: Array.isArray(views) ? views : [views],
                    semanticModel: null,
                  }))
                }
                placeholder="Select semantic view"
                multiple
                disabled={!!(formData as any).stage}
              />
            </Box>

            <Box sx={{ flex: 1 }}>
              <Dropdown
                label="Select Semantic Model*"
                options={semanticModelOptions}
                value={formData.semanticModel ?? ''}
                onChange={(m) =>
                  setFormData((prev) => ({
                    ...prev,
                    semanticModel: normalizeToString(m),
                    semanticView: [],
                  }))
                }
                placeholder="Select semantic model"
                disabled={!(formData as any).stage}
              />
            </Box>
          </Box>

          {((errors as any).semanticView || (errors as any).semanticModel) && (
            <Typography sx={{ color: '#d32f2f', fontSize: '12px', mt: 1 }}>
              {(errors as any).semanticView || (errors as any).semanticModel}
            </Typography>
          )}
        </>
      )}

      {/* Action buttons */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: '24px' }}>
        <Button variant="outlined" onClick={onBack} startIcon={<ArrowBackIcon />}>
          Back
        </Button>

        <Button
          variant="contained"
          onClick={handleNext}
          endIcon={<ArrowForwardIcon />}
          disabled={isNextDisabled}
          sx={{
            backgroundColor: isNextDisabled ? '#d0d7de' : '#1976d2',
            color: isNextDisabled ? '#6e7781' : '#fff',
          }}
        >
          {isCheckingPipelineName ? 'Checking...' : 'Next'}
        </Button>
      </Box>
    </Box>
  );
};

export default PipelineForm;