import React, { useState, useEffect, useMemo } from 'react';
import {
  Button,
  FormControl,
  Select,
  MenuItem,
  Chip,
  Box,
  Typography,
  IconButton,
  OutlinedInput,
  type SelectChangeEvent,
  InputLabel,
  CircularProgress,
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close';

import Dialog from '../Dialog/Dialog';
import SuccessDialog from '../SuccessDialog/SuccessDialog';
import styles from './ModelDeployDialog.module.scss';

import { models as DEFAULT_MODEL_IDS, MODEL_ID_TO_LABEL } from '../../../constants/models';
import type { Chatbot } from '../../../types/chatbot';
import { useChatbot } from '../../../context/ChatbotContext';
import { useAppContext } from '../../../context/AppContext';
import { ChatbotAPI } from '../../../api/endpoints/chatbot.api';
import { SnowflakeAPI } from '../../../api/endpoints/snowflake.api';

interface ModelDeployDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (model: string, roles: string[]) => void;
  chatbot: Chatbot;

  /**
   * If provided, we show these models in the dropdown.
   * In your case, you pass all 3 always:
   * availableModels={[...AVAILABLE_MODEL_IDS]}
   */
  availableModels?: string[];
}

const ModelDeployDialog: React.FC<ModelDeployDialogProps> = ({
  open,
  onClose,
  onConfirm,
  availableModels,
}) => {
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [deploying, setDeploying] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [showSuccess, setShowSuccess] = useState<boolean>(false);

  const { chatbot, pipeline, prompt } = useChatbot();
  const { currentUser, mode } = useAppContext();

  // Pipeline & prompt selectors
  const [availablePipelines, setAvailablePipelines] = useState<string[]>([]);
  const [availablePrompts, setAvailablePrompts] = useState<{ id: string; name: string }[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<string>('');
  const [selectedPrompt, setSelectedPrompt] = useState<string>('');

  // For TalkToData: semantic view/model selection (sourced from pipeline only)
  const [selectedSemanticView, setSelectedSemanticView] = useState<string>('');
  const [availableSemanticOptions, setAvailableSemanticOptions] = useState<string[]>([]);

  // ✅ Models to show in deploy dropdown
  // You want always all 3 -> Experimentation passes them here.
  const modelIdsToShow = useMemo(() => {
    if (Array.isArray(availableModels) && availableModels.length > 0) {
      return availableModels;
    }
    return DEFAULT_MODEL_IDS; // fallback to constants (your 3 claude)
  }, [availableModels]);

  const handleModelChange = (event: SelectChangeEvent) => {
    setSelectedModel(event.target.value);
  };

  // ✅ Default model selection when dialog opens (TalkToDocument)
  useEffect(() => {
    if (!open) return;

    if (mode === 'TalkToDocument') {
      const first = modelIdsToShow[0] ?? '';
      if (!selectedModel || !modelIdsToShow.includes(selectedModel)) {
        setSelectedModel(first);
      }
    } else {
      // For TalkToData, model selection not required here
      setSelectedModel('');
    }
  }, [open, mode, modelIdsToShow, selectedModel]);

  useEffect(() => {
    // when selectedPipeline changes, recompute options from the cached pipelines list
    const refreshForPipeline = async () => {
      try {
        const respAny = await ChatbotAPI.getPipelines();

        // respAny may be: array of rows OR an object { pipelines: rows } depending on server wrapper.
        let rows: any[] = [];
        if (Array.isArray(respAny)) {
          rows = respAny;
        } else if (respAny && Array.isArray((respAny as any).pipelines)) {
          rows = (respAny as any).pipelines;
        } else {
          rows = normalizeRows(respAny);
        }

        const row =
          rows.find((r: any) => {
            const nameVal = getField(r, 'PIPELINE_NAME', 'pipeline_name', 'name', 'NAME');
            if (!nameVal) return false;
            try {
              return (
                String(nameVal).trim().toLowerCase() ===
                String(selectedPipeline).trim().toLowerCase()
              );
            } catch {
              return false;
            }
          }) ||
          rows.find(
            (r: any) =>
              String(getField(r, 'PIPELINE_ID', 'pipeline_id', 'id', 'ID') ?? '').trim() ===
              String(selectedPipeline).trim()
          );

        // Pull semantic options from the pipeline row (SEMANTIC_VIEW or SEMANTIC_MODEL)
        const semanticView = getField(row, 'SEMANTIC_VIEW', 'semantic_view');
        const semanticModel = getField(row, 'SEMANTIC_MODEL', 'semantic_model');
        const hasView = Array.isArray(semanticView)
          ? semanticView.length > 0
          : typeof semanticView === 'string'
            ? semanticView.trim() !== ''
            : false;

        const source = hasView ? semanticView : semanticModel;
        const options = toStringArray(source);

        setAvailableSemanticOptions(options);
        setSelectedSemanticView((prev) => (prev && options.includes(prev) ? prev : (options[0] ?? '')));
      } catch (e) {
        console.warn('Failed to refresh semantic options for pipeline', e);
        setAvailableSemanticOptions([]);
        setSelectedSemanticView('');
      }
    };

    if (selectedPipeline) {
      refreshForPipeline();
    }
  }, [selectedPipeline]);

  // Safely pull a field regardless of casing/alias
  const getField = (row: any, ...candidates: string[]) => {
    if (!row) return undefined;
    const keys = Object.keys(row ?? {});
    for (const name of candidates) {
      const hit = keys.find((k) => k.toLowerCase() === name.toLowerCase());
      if (hit) return row[hit];
    }
    return undefined;
  };

  // Turn a string/array/undefined into a clean string[].
  const toStringArray = (value: unknown): string[] => {
    if (!value && value !== 0) return [];
    if (Array.isArray(value)) {
      return value
        .map(String)
        .map((s) => s.trim())
        .filter(Boolean);
    }
    const s = String(value).trim();
    if (!s) return [];
    return s.includes(',')
      ? s.split(',').map((v) => v.trim()).filter(Boolean)
      : [s];
  };

  // Normalize API payload into an array of rows
  const normalizeRows = (respAny: any): any[] => {
    if (!respAny) return [];
    if (Array.isArray(respAny)) return respAny;
    if (Array.isArray(respAny?.data)) return respAny.data;
    if (respAny?.data && typeof respAny.data === 'object') return [respAny.data];
    if (typeof respAny === 'object') return [respAny];
    return [];
  };

  const handleRoleChange = (event: SelectChangeEvent<string[]>) => {
    const value = event.target.value;
    setSelectedRoles(typeof value === 'string' ? value.split(',') : value);
  };

  const handleRemoveRole = (roleToRemove: string) => {
    setSelectedRoles(selectedRoles.filter((role) => role !== roleToRemove));
  };

  const handleCancel = () => {
    if (!deploying) {
      setSelectedModel('');
      setSelectedRoles([]);
      setError('');
      onClose();
    }
  };

  const handleSuccessClose = () => {
    setShowSuccess(false);
    // Reset form
    setSelectedModel('');
    setSelectedRoles([]);
    // Call callbacks
    onConfirm(selectedModel, selectedRoles);
    onClose();
  };

  useEffect(() => {
    if (error) console.log('ModelDeployDialog error:', error);
  }, [error]);

  const handleConfirmDeployment = async () => {
    if (selectedRoles.length === 0) {
      setError('Please select at least one role');
      return;
    }

    if (mode === 'TalkToDocument' && !selectedModel) {
      setError('Please select a model');
      return;
    }

    if (!chatbot?.CHATBOT_NAME || !chatbot?.CHATBOT_TYPE || !pipeline?.PIPELINE_NAME) {
      setError('Missing chatbot or pipeline information');
      return;
    }

    setDeploying(true);
    setError('');

    try {
      const deployedBy = currentUser?.USERNAME || 'Unknown';
      const payload: any = {
        chatbotId: chatbot.CHATBOT_ID,
        chatbotName: chatbot.CHATBOT_NAME,
        chatbotType: chatbot.CHATBOT_TYPE,
        model:
          mode === 'TalkToDocument'
            ? selectedModel
            : selectedSemanticView || chatbot?.APP_MODEL_NAME || selectedModel,
        roles: selectedRoles,
        pipelineName: selectedPipeline || pipeline?.PIPELINE_NAME,
        deployedBy,
      };

      // Include prompt_id only for TalkToDocument (backend expects snake_case)
      if (mode === 'TalkToDocument') {
        payload.prompt_id = selectedPrompt || null;
      }

      const response = await ChatbotAPI.deployChatbot(payload);
      if (response && response.chatbotType) {
        setShowSuccess(true);
      }
    } catch (err) {
      console.error('Error deploying model:', err);
      setError('Failed to deploy model. Please try again.');
    } finally {
      setDeploying(false);
    }
  };

  const fetchRoles = async () => {
    setLoading(true);
    setError('');
    try {
      const rolesData = await SnowflakeAPI.getRoles();
      const roles = rolesData.map((item) => item.ROLE);
      setAvailableRoles(roles);
    } catch (err) {
      console.error('Error fetching roles:', err);
      setError('Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const fetchPipelines = async () => {
    try {
      const resp = await ChatbotAPI.getPipelines();
      const rows = normalizeRows(resp);

      const names = rows.map(
        (p: any) => getField(p, 'PIPELINE_NAME', 'pipeline_name', 'name', 'NAME') ?? String(p)
      );
      setAvailablePipelines(names);

      const pipelineName = selectedPipeline || names[0] || '';
      if (pipelineName) {
        const row = rows.find(
          (r: any) => getField(r, 'PIPELINE_NAME', 'pipeline_name', 'name', 'NAME') === pipelineName
        );

        const semanticView = getField(row, 'SEMANTIC_VIEW', 'semantic_view');
        const semanticModel = getField(row, 'SEMANTIC_MODEL', 'semantic_model');
        const hasView = Array.isArray(semanticView)
          ? semanticView.length > 0
          : typeof semanticView === 'string'
            ? semanticView.trim() !== ''
            : false;

        const options = toStringArray(hasView ? semanticView : semanticModel);

        setAvailableSemanticOptions(options);
        setSelectedSemanticView((prev) => (prev && options.includes(prev) ? prev : (options[0] ?? '')));
      } else {
        setAvailableSemanticOptions([]);
        setSelectedSemanticView('');
      }
    } catch (err) {
      console.error('Error fetching pipelines:', err);
    }
  };

  const fetchPrompts = async () => {
    try {
      const resp = await ChatbotAPI.getPrompts();
      const respAny: any = resp;
      const rows = Array.isArray(respAny) ? respAny : (respAny?.data ?? []);
      const normalized = (rows || []).map((p: any) => ({
        id: String(p?.PROMPT_ID ?? p?.id ?? p?.ID ?? p?.prompt_id ?? ''),
        name: String(p?.PROMPT_NAME ?? p?.NAME ?? p?.name ?? p?.name_text ?? p ?? ''),
      }));
      setAvailablePrompts(normalized);
    } catch (err) {
      console.error('Error fetching prompts:', err);
    }
  };

  useEffect(() => {
    if (open) {
      fetchRoles();
      fetchPipelines();

      if (mode === 'TalkToDocument') {
        fetchPrompts();
        setSelectedPrompt(prompt?.PROMPT_ID != null ? String(prompt.PROMPT_ID) : '');
      } else {
        setSelectedPrompt('');
      }

      setSelectedPipeline(pipeline?.PIPELINE_NAME ?? '');
    }
  }, [open]);

  const dialogActions = (
    <>
      <Button
        variant="outlined"
        onClick={handleCancel}
        className={styles.backButton}
        disabled={deploying}
      >
        Cancel
      </Button>
      <Button
        variant="contained"
        endIcon={<ArrowForwardIcon />}
        onClick={handleConfirmDeployment}
        className={styles.confirmButton}
        disabled={
          loading ||
          deploying ||
          selectedRoles.length === 0 ||
          (mode === 'TalkToDocument' && !selectedModel)
        }
      >
        {deploying ? <CircularProgress size={24} /> : 'Confirm Deployment'}
      </Button>
    </>
  );

  return (
    <>
      <Dialog
        open={open && !showSuccess}
        onClose={onClose}
        title="Select model to deploy"
        actions={dialogActions}
        maxWidth="sm"
      >
        <Box className={styles.dialogBody}>
          {/* Model Selection: show only in TalkToDocument mode */}
          {mode === 'TalkToDocument' && (
            <Box className={styles.fieldGroup}>
              <FormControl fullWidth className={styles.selectField}>
                <InputLabel id="model-label">Choose Model</InputLabel>
                <Select
                  labelId="model-label"
                  value={selectedModel}
                  onChange={handleModelChange}
                  displayEmpty
                  className={styles.select}
                >
                  {modelIdsToShow.map((id) => (
                    <MenuItem key={id} value={id}>
                      {MODEL_ID_TO_LABEL[id] ?? id}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <IconButton className={styles.helpIcon}>
                <HelpOutlineIcon />
              </IconButton>
            </Box>
          )}

          {/* Semantic View / Model Selection - only for TalkToData (sourced from pipeline) */}
          {mode === 'TalkToData' && (
            <Box className={styles.fieldGroup}>
              <FormControl fullWidth className={styles.selectField}>
                <InputLabel id="semantic-label">Choose Semantic View/Model</InputLabel>
                <Select
                  labelId="semantic-label"
                  value={selectedSemanticView}
                  onChange={(e) => setSelectedSemanticView(e.target.value as string)}
                  displayEmpty
                  className={styles.select}
                >
                  {availableSemanticOptions.map((m) => (
                    <MenuItem key={m} value={m}>
                      {m}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box className={styles.iconGroup}>
                <IconButton className={styles.helpIcon}>
                  <HelpOutlineIcon />
                </IconButton>
              </Box>
            </Box>
          )}

          {/* Role Selection */}
          <Box className={styles.fieldGroup}>
            <FormControl fullWidth className={styles.selectField}>
              <InputLabel id="role-label">Choose Role</InputLabel>
              <Select
                labelId="role-label"
                multiple
                value={selectedRoles}
                onChange={handleRoleChange}
                displayEmpty
                input={<OutlinedInput />}
                className={styles.select}
                MenuProps={{ PaperProps: { style: { maxHeight: 250 } } }}
              >
                {availableRoles.map((role) => (
                  <MenuItem key={role} value={role}>
                    {role}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box className={styles.iconGroup}>
              <IconButton className={styles.helpIcon}>
                <HelpOutlineIcon />
              </IconButton>
            </Box>
          </Box>

          {/* Note */}
          <Typography className={styles.note}>
            <span className={styles.noteLabel}>Note:</span> you can select multiple options.
          </Typography>

          {/* Selected Roles Chips */}
          {selectedRoles.length > 0 && (
            <Box className={styles.chipsContainer}>
              {selectedRoles.map((role) => (
                <Chip
                  key={role}
                  label={role}
                  onDelete={() => handleRemoveRole(role)}
                  className={styles.roleChip}
                  deleteIcon={<CloseIcon className={styles.chipDeleteIcon} />}
                />
              ))}
            </Box>
          )}

          {/* Pipeline Selection */}
          <Box className={styles.fieldGroup}>
            <FormControl fullWidth className={styles.selectField}>
              <InputLabel id="pipeline-label">Choose pipeline</InputLabel>
              <Select
                labelId="pipeline-label"
                value={selectedPipeline}
                onChange={(e) => setSelectedPipeline(e.target.value as string)}
                displayEmpty
                className={styles.select}
              >
                {availablePipelines.map((p) => (
                  <MenuItem key={p} value={p}>
                    {p}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Box className={styles.iconGroup}>
              <IconButton className={styles.helpIcon}>
                <HelpOutlineIcon />
              </IconButton>
            </Box>
          </Box>

          {/* Prompt Selection - only for TalkToDocument */}
          {mode === 'TalkToDocument' && (
            <Box className={styles.fieldGroup}>
              <FormControl fullWidth className={styles.selectField}>
                <InputLabel id="prompt-label">Choose prompt</InputLabel>
                <Select
                  labelId="prompt-label"
                  value={selectedPrompt}
                  onChange={(e) => setSelectedPrompt(e.target.value as string)}
                  displayEmpty
                  className={styles.select}
                >
                  {availablePrompts.map((pr) => (
                    <MenuItem key={pr.id} value={pr.id}>
                      {pr.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Box className={styles.iconGroup}>
                <IconButton className={styles.helpIcon}>
                  <HelpOutlineIcon />
                </IconButton>
              </Box>
            </Box>
          )}
        </Box>
      </Dialog>

      <SuccessDialog
        open={showSuccess}
        onClose={handleSuccessClose}
        message="Chatbot deployed"
        subMessage="displayed results"
      />
    </>
  );
};

export default ModelDeployDialog;