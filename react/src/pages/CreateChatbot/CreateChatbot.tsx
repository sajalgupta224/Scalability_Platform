import React, { useMemo, useState } from 'react';
import { Autocomplete, Box, Button, CircularProgress, TextField } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import PageHeader from '../../components/ui/PageHeader/PageHeader';
import Dropdown from '../../components/ui/Dropdown/Dropdown';
import type { DropdownOption } from '../../types/ui.types';
import styles from './CreateChatbot.module.scss';
import type { ChatbotFormData, ChatbotOption, ChatbotView } from '../../types/chatbot';
import { useNotification } from '../../hooks/useNotification';
import { useChatbot } from '../../context/ChatbotContext';
import { useAppContext } from '../../context/AppContext';

const CreateChatbot: React.FC = () => {
  const navigate = useNavigate();
  const { showNotification } = useNotification();
  const { mode } = useAppContext();

  const {
    availableChatbots,
    pipelines,
    prompts,
    isLoadingChatbots,
    isLoadingPipelines,
    isLoadingPrompts,
    chatbotsError,
    selectChatbot,
    createChatbot,
  } = useChatbot();

  // Local UI state
  const [currentView, setCurrentView] = useState<ChatbotView>('search');
  const [selectedChatbot, setSelectedChatbot] = useState<ChatbotOption | null>(null);
  const [formData, setFormData] = useState<ChatbotFormData>({
    chatbotName: '',
    pipelineId: '',
    promptId: '',
  });
  const [isCreating, setIsCreating] = useState(false);

  const handleChatbotSelect = async (chatbotOption: ChatbotOption | null) => {
    setSelectedChatbot(chatbotOption);
    if (chatbotOption) {
      // Update context with selected chatbot (will fetch full chatbot data)
      await selectChatbot(chatbotOption);

      // Navigate to Experimentation
      navigate('/experimentation');
    }
  };

  const handleCreateNewChatbot = () => {
    setCurrentView('create');
  };

  const pipelineOptions: DropdownOption[] = useMemo(
    () => (Array.isArray(pipelines) ? pipelines : []).map((pipeline) => ({ label: pipeline.name, value: pipeline.id })),
    [pipelines]
  );

  const promptOptions: DropdownOption[] = useMemo(
    () => (Array.isArray(prompts) ? prompts : []).map((prompt) => ({ label: prompt.name, value: prompt.id })),
    [prompts]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePipelineChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      pipelineId: value,
    }));
  };

  const handlePromptChange = (value: string) => {
    setFormData((prev) => ({
      ...prev,
      promptId: value,
    }));
  };

  const handleCreate = async () => {
    if (!isFormValid()) {
      return;
    }

    setIsCreating(true);
    try {
      // Create chatbot via context (context will handle fetching full chatbot data)
      const id = await createChatbot(formData);

      showNotification({
        type: 'success',
        message: `Chatbot "${formData.chatbotName}" created successfully.`,
        autoHideDuration: 3000,
      });

      // Navigate to Experimentation with chatbot ID and mode in URL
      navigate(`/experimentation/${id}?mode=${mode}`, { state: { from: 'experiment' } });
    } catch (error) {
      console.error('Error creating chatbot:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const isFormValid = () => {
    return formData.chatbotName.trim() !== '' && formData.pipelineId !== '';
  };

  const renderSearchView = () => (
    <Box className={styles.searchViewContainer}>
      <Box className={styles.searchWrapper}>
        <Autocomplete
          options={availableChatbots}
          getOptionLabel={(option) => option.name}
          value={selectedChatbot}
          onChange={(_event, newValue) => handleChatbotSelect(newValue)}
          loading={isLoadingChatbots}
          className={styles.searchAutocomplete}
          ListboxProps={{
            style: {
              maxHeight: '300px',
            },
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              placeholder="Search Chatbot Name"
              InputProps={{
                ...params.InputProps,
                startAdornment: (
                  <>
                    <SearchIcon className={styles.searchIcon} />
                    {params.InputProps.startAdornment}
                  </>
                ),
                endAdornment: (
                  <>
                    {isLoadingChatbots ? <CircularProgress color="inherit" size={20} /> : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
              className={styles.searchInput}
            />
          )}
          noOptionsText={chatbotsError || 'No chatbots found'}
        />

        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleCreateNewChatbot}
          className={styles.createButton}
        >
          Create new Chatbot
        </Button>
      </Box>
    </Box>
  );

  const renderCreateView = () => (
    <Box className={styles.createViewContainer}>
      <h2 className={styles.formTitle}>Create new chatbot</h2>
      <Box className={styles.formCardWrapper}>
        <Box className={styles.formCard}>
          <Box className={styles.formContent}>
            {/* Chatbot Name Field */}
            <Box className={styles.formField}>
              <TextField
                name="chatbotName"
                label="Chatbot name*"
                value={formData.chatbotName}
                onChange={handleInputChange}
                fullWidth
                className={styles.inputField}
                disabled={isCreating}
              />
            </Box>

            {/* Choose Pipeline Field */}
            <Box className={styles.formField}>
              {isLoadingPipelines ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', padding: 2 }}>
                  <CircularProgress size={20} />
                </Box>
              ) : (
                <Dropdown
                  label="Choose Pipeline*"
                  options={pipelineOptions}
                  value={formData.pipelineId}
                  onChange={handlePipelineChange}
                  placeholder="Select pipeline"
                  disabled={isCreating}
                />
              )}
            </Box>

            {/* Prompt Field (Optional) */}
            <Box className={styles.formField}>
              {isLoadingPrompts ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', padding: 2 }}>
                  <CircularProgress size={20} />
                </Box>
              ) : (
                <Dropdown
                  label="Choose Prompt (Optional)"
                  options={promptOptions}
                  value={formData.promptId ?? ''}
                  onChange={handlePromptChange}
                  placeholder="Select prompt"
                  disabled={isCreating}
                />
              )}
            </Box>

            {/* Action Buttons */}
            <Box className={styles.formActions}>
              <Button
                variant="outlined"
                onClick={() => setCurrentView('search')}
                className={styles.backButton}
                disabled={isCreating}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleCreate}
                disabled={!isFormValid() || isCreating}
                className={styles.nextButton}
              >
                {isCreating ? (
                  <>
                    <CircularProgress size={20} style={{ marginRight: 8 }} />
                    Creating...
                  </>
                ) : (
                  'Create'
                )}
              </Button>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box className={styles.pageContainer}>
      <Box className={styles.contentWrapper}>
        <PageHeader
          title="Services"
          subtitle={currentView === 'search' ? 'Talk to document' : 'Experiment'}
        />

        {currentView === 'search' ? renderSearchView() : renderCreateView()}
      </Box>
    </Box>
  );
};

export default CreateChatbot;
