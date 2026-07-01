import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Autocomplete,
  Box,
  Checkbox,
  ListItemText,
  TextField,
  Button,
  CircularProgress,
} from '@mui/material';
import PipelineSection from '../PipelineSection/PipelineSection';
import DocumentSection from '../DocumentSection/DocumentSection';
import styles from './PipelinePanel.module.scss';
import type { Document } from '../../../types/ui.types';
import type { Mode } from '../../../context/AppContext';
import { MODEL_ID_TO_LABEL, MAX_SELECTED_MODELS } from '../../../constants/models';
import { useNotification } from '../../../hooks/useNotification';
import { useChatbot } from '../../../context/ChatbotContext';
import type { ChatbotFormData } from '../../../types/chatbot';

interface PipelinePanelProps {
  pipeline: string;
  pipelines: { id: string; name: string }[];
  onSelect: (val: string) => void;
  onCreatePipeline?: () => void;

  documents: Document[];
  chatbotName: string;
  isCreateMode?: boolean;
  mode?: Mode;

  availableModels?: string[];
  selectedModels?: string[];
  onModelsChange?: (models: string[]) => void;
  openedFromDeployed?: boolean;
}

const PipelinePanel: React.FC<PipelinePanelProps> = ({
  pipeline,
  pipelines,
  onSelect,
  documents,
  chatbotName,
  isCreateMode = false,
  mode,
  availableModels,
  selectedModels,
  onModelsChange,
  openedFromDeployed,
}) => {
   const navigate = useNavigate();
  const { showNotification } = useNotification();
  const { createChatbot } = useChatbot();

  const [selectedPromptFromSection, setSelectedPromptFromSection] = useState<string>('');
  const [isCreating, setIsCreating] = useState(false);

  const [modelsTouched, setModelsTouched] = useState(false);

  const isTalkToDocument = mode === 'TalkToDocument';

  const canShowModels =
    isTalkToDocument &&
    Array.isArray(availableModels) &&
    Array.isArray(selectedModels) &&
    typeof onModelsChange === 'function';

  const effectiveModelOptions = useMemo(() => {
    if (openedFromDeployed) {
      const only = 'llama3.1-70b';
      if (Array.isArray(availableModels) && availableModels.length > 0) {
        return availableModels.includes(only) ? [only] : [only];
      }
      return [only];
    }
    return availableModels ?? [];
  }, [availableModels, openedFromDeployed]);

  const showModelsSection =
    isTalkToDocument &&
    (openedFromDeployed ||
      (Array.isArray(availableModels) &&
        Array.isArray(selectedModels) &&
        typeof onModelsChange === 'function'));

  useEffect(() => {
    if (!openedFromDeployed) return;
    setModelsTouched(true);
    if (typeof onModelsChange === 'function') {
      const forced = ['llama3.1-70b'];
      if (!Array.isArray(selectedModels) || selectedModels.join(',') !== forced.join(',')) {
        try {
          onModelsChange(forced);
        } catch (e) {
          console.warn('Failed to set forced model selection for deployed view', e);
        }
      }
    }
  }, [openedFromDeployed, onModelsChange, selectedModels]);

  const hasSelectedAtLeastOneModel = (selectedModels?.length ?? 0) > 0 || openedFromDeployed;

  const handleModelsChange = (_event: unknown, newValue: string[]) => {
    if (!onModelsChange) return;

    setModelsTouched(true);

    if (newValue.length === 0) {
      onModelsChange([]);
      return;
    }

    if (newValue.length > MAX_SELECTED_MODELS) {
      showNotification({
        type: 'warning',
        message: `You can select maximum ${MAX_SELECTED_MODELS} models.`,
        autoHideDuration: 2500,
      });
      return;
    }

    onModelsChange(newValue);
  };

  const handleCreateChatbot = async () => {
    if (isTalkToDocument) setModelsTouched(true);

    if (!pipeline) {
      showNotification({
        type: 'error',
        message: 'Please select a pipeline first.',
        autoHideDuration: 3000,
      });
      return;
    }

    if (!chatbotName.trim()) {
      showNotification({
        type: 'error',
        message: 'Please enter a chatbot name.',
        autoHideDuration: 3000,
      });
      return;
    }

    if (canShowModels && !hasSelectedAtLeastOneModel) {
      showNotification({
        type: 'error',
        message: 'Please select at least one model.',
        autoHideDuration: 3000,
      });
      return;
    }

    setIsCreating(true);
    try {
      const formData: ChatbotFormData = {
        chatbotName: chatbotName.trim(),
        pipelineId: pipeline,
        promptId: selectedPromptFromSection,
        modelIds: selectedModels ?? [],
      };

      const id = await createChatbot(formData);

      showNotification({
        type: 'success',
        message: `Chatbot "${chatbotName}" created successfully.`,
        autoHideDuration: 3000,
      });
        navigate(`/experimentation/${id}`, { state: { from: 'experiment' } });
    } catch (err) {
      console.error('Error creating chatbot:', err);
      showNotification({
        type: 'error',
        message: 'Failed to create chatbot. Please try again.',
        autoHideDuration: 3000,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const isFormValid = () => {
    const baseValid = chatbotName.trim() !== '' && pipeline !== '';
    if (!baseValid) return false;

    if (canShowModels) return hasSelectedAtLeastOneModel;

    return true;
  };

  const showModelsError = canShowModels && modelsTouched && !hasSelectedAtLeastOneModel;

  // Normalize selectedModels to ensure it's an array of individual strings
  const normalizedSelectedModels = useMemo(() => {
    if (!selectedModels) return [];
    if (!Array.isArray(selectedModels)) return [];
    
    // Flatten in case there are nested arrays and split any comma-separated strings
    return selectedModels
      .flat()
      .flatMap((m) => {
        const str = String(m).trim();
        // If this looks like a comma-separated list, split it
        if (str.includes(',')) {
          return str.split(',').map(s => s.trim()).filter(s => s.length > 0);
        }
        return str.length > 0 ? [str] : [];
      });
  }, [selectedModels]);

  const containerClass = styles.panel;

  return (
    <Box className={containerClass}>
      <PipelineSection
        pipeline={pipeline}
        pipelines={pipelines}
        onSelect={onSelect}
        chatbotName={chatbotName}
        isCreateMode={isCreateMode}
        mode={mode}
        hideCreateButton
        onPromptSelected={setSelectedPromptFromSection}
      />

      {showModelsSection && (
        <Box className={styles.modelsSection}>
          <Autocomplete
            multiple
            disableCloseOnSelect
            options={effectiveModelOptions}
            value={
              !isCreateMode
                ? normalizedSelectedModels
                : (openedFromDeployed ? ['llama3.1-70b'] : normalizedSelectedModels)
            }
            // allow editing for existing chatbots as well; only force-disable when openedFromDeployed
            disabled={openedFromDeployed}
            onChange={handleModelsChange}
            getOptionLabel={(id) => MODEL_ID_TO_LABEL[id] ?? id}
            className={styles.modelsAutocomplete}
            renderOption={(props, option, { selected }) => (
              <li {...props}>
                <Checkbox checked={selected} style={{ marginRight: 8 }} />
                <ListItemText primary={MODEL_ID_TO_LABEL[option] ?? option} />
              </li>
            )}
            renderInput={(params) => {
              const isDisabled = openedFromDeployed;
              return (
                <TextField
                  {...params}
                  label="Select models"
                  placeholder={isDisabled ? undefined : 'Select 1 to 3 models'}
                  error={!isDisabled && showModelsError}
                  helperText={
                    isDisabled
                      ? undefined
                      : showModelsError
                        ? 'Model selection is required.'
                        : `Select maximum ${MAX_SELECTED_MODELS} models`
                  }
                  onBlur={isDisabled ? undefined : () => setModelsTouched(true)}
                  slotProps={{
                    htmlInput: { ...params.inputProps, style: isDisabled ? { display: 'none' } : undefined },
                    input: { ...params.InputProps, endAdornment: isDisabled ? null : params.InputProps.endAdornment },
                  }}
                />
              );
            }}
          />
        </Box>
      )}

      {/* --------------------------------------------------------
          🚫 HIDE CREATE CHATBOT BUTTON IF openedFromDeployed = true
         -------------------------------------------------------- */}
      {!openedFromDeployed && (
        <>
          <Box className={styles.divider} />
          <Button
            fullWidth
            variant="contained"
            onClick={handleCreateChatbot}
            disabled={!isFormValid() || isCreating || !isCreateMode}
            className={styles.createChatbotBtn}
          >
            {isCreating ? (
              <>
                <CircularProgress size={20} style={{ marginRight: 8 }} />
                Creating...
              </>
            ) : (
              'Create Chatbot'
            )}
          </Button>
        </>
      )}

      {mode === 'TalkToDocument' && !openedFromDeployed && (
        <>
          <Box className={styles.divider} />
          <DocumentSection documents={documents} />
        </>
      )}
    </Box>
  );
};

export default PipelinePanel;
