import React, { useState, useEffect } from 'react';
import {
  Box,
  Select,
  MenuItem,
  Button,
  FormControl,
  InputLabel,
  CircularProgress,
} from '@mui/material';
import styles from './PipelineSection.module.scss';
import { useChatbot } from '../../../context/ChatbotContext';
import { useNotification } from '../../../hooks/useNotification';
import type { ChatbotFormData } from '../../../types/chatbot';
import type { Mode } from '../../../context/AppContext';

interface PipelineSectionProps {
  pipeline: string;
  pipelines: { id: string; name: string }[];
  onSelect: (val: string) => void;

  // kept for compatibility (currently not used)
  onCreatePipeline?: () => void;

  chatbotName: string;
  isCreateMode?: boolean;
  mode?: Mode;

  // ✅ NEW
  hideCreateButton?: boolean;

  // ✅ NEW: let parent know which prompt is selected
  onPromptSelected?: (promptId: string) => void;
}

const PipelineSection: React.FC<PipelineSectionProps> = ({
  pipeline,
  pipelines,
  onSelect,
  chatbotName,
  isCreateMode = false,
  mode,
  hideCreateButton = false,
  onPromptSelected,
}) => {
  const { prompts, isLoadingPrompts, createChatbot, chatbot } = useChatbot();
  const { showNotification } = useNotification();

  const [selectedPrompt, setSelectedPrompt] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Reset form fields when switching to create mode or when chatbot changes
  useEffect(() => {
    let nextPrompt = '';

    if (isCreateMode) {
      // Auto-select "default prompt" if available
      const defaultPrompt = prompts.find((p) => p.name.toLowerCase() === 'default prompt');
      nextPrompt = defaultPrompt?.id || '';
    } else if (chatbot?.PROMPT_ID) {
      nextPrompt = chatbot.PROMPT_ID;
    }

    setSelectedPrompt(nextPrompt);

    // ✅ inform parent
    if (onPromptSelected) onPromptSelected(nextPrompt);
  }, [isCreateMode, chatbot, prompts, onPromptSelected]);

  const isTalkToData = mode === 'TalkToData';

  const handlePromptChange = (event: any) => {
    const val = event.target.value;
    setSelectedPrompt(val);

    // ✅ inform parent
    if (onPromptSelected) onPromptSelected(val);
  };

  // Keep original create logic here (only used when hideCreateButton=false)
  const handleCreateChatbot = async () => {
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

    setIsCreating(true);
    try {
      const formData: ChatbotFormData = {
        chatbotName: chatbotName.trim(),
        pipelineId: pipeline,
        promptId: selectedPrompt,
      };

      await createChatbot(formData);

      showNotification({
        type: 'success',
        message: `Chatbot "${chatbotName}" created successfully.`,
        autoHideDuration: 3000,
      });
    } catch (error) {
      console.error('Error creating chatbot:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const isFormValid = () => {
    return chatbotName.trim() !== '' && pipeline !== '';
  };

  return (
    <Box className={styles.pipelineSection}>
      {/* Pipeline Selection */}
      <FormControl fullWidth className={styles.selectFormControl}>
        <InputLabel id="pipeline-label">Select Pipeline*</InputLabel>
        <Select
          labelId="pipeline-label"
          fullWidth
          value={pipeline || ''}
          onChange={(e) => onSelect(e.target.value)}
          displayEmpty
          className={styles.pipelineSelect}
          disabled={!isCreateMode || isCreating}
        >
          {pipelines.map((p, idx) => (
            <MenuItem key={idx} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Prompt Selection - Hidden in TalkToData mode */}
      {!isTalkToData && (
        <FormControl fullWidth className={styles.selectFormControl}>
          <InputLabel id="prompt-label">Choose Prompt</InputLabel>
          <Select
            labelId="prompt-label"
            value={selectedPrompt || ''}
            onChange={handlePromptChange}
            displayEmpty
            className={styles.pipelineSelect}
            disabled={!isCreateMode || isCreating}
          >
            {isLoadingPrompts ? (
              <MenuItem disabled>
                <CircularProgress size={20} />
              </MenuItem>
            ) : (
              prompts.map((prompt) => (
                <MenuItem key={prompt.id} value={prompt.id}>
                  {prompt.name}
                </MenuItem>
              ))
            )}
          </Select>
        </FormControl>
      )}

      {/* ✅ Create Chatbot Button (only if not hidden) */}
      {!hideCreateButton && (
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
      )}
    </Box>
  );
};

export default PipelineSection;