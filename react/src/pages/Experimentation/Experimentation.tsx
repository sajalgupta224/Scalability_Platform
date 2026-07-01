import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import CircularProgress from '@mui/material/CircularProgress';

import type { CitationsMap } from '../../types/citations.types';
import type { Document } from '../../types/ui.types';
import type { ModelComparisonData } from '../../types/models.types';
import type { ChatItem } from '../../types/pages.types';

import styles from './Experimentation.module.scss';

import { ChatbotAPI } from '../../api/endpoints/chatbot.api';
import { ModelsAPI } from '../../api/endpoints/models.api';
import { PipelineAPI } from '../../api/endpoints/pipeline.api';

import ChatInput from '../../components/ui/ChatInput/ChatInput';
import ChatBottomActions from '../../components/ui/ChatBottomActions/ChatBottomActions';
import SidePanel from '../../components/ui/Sidepanel/Sidepanel';
import PipelinePanel from '../../components/ui/PipelinePanel/PipelinePanel';
import ModelComparisonPanel from '../../components/ui/ModelComparisonPanel/ModelComparisonPanel';
import ModelDeployDialog from '../../components/ui/ModelDeployDialog/ModelDeployDialog';

import { MODEL_ID_TO_LABEL, MAX_SELECTED_MODELS } from '../../constants/models';

import { useChatbot } from '../../context/ChatbotContext';
import { useNotification } from '../../hooks/useNotification';
import { useAppContext } from '../../context/AppContext';

import ChatHeader from './components/ChatHeader';
import BotIntroSection from './components/BotIntroSection';
import ChatHistoryDisplay from './components/ChatHistoryDisplay';
import ChatDataHistoryDisplay from './components/ChatDataHistoryDisplay';

import { useChatbotName } from '../../hooks/useChatbotName';
import { usePanelState } from '../../hooks/usePanelState';
import { useAgentStreaming, resolveResponseId } from '../../hooks/useAgentStreaming';
import { useStructuredAgent } from '../../hooks/useStructuredAgent';

import { getSignedInUserId } from '../../utils/sessionUtils';

import { downloadResponsePdf } from '../../utils/downloadResponsePdf';
import { downloadResponseDocx } from '../../utils/downloadResponseDocx';
import { downloadResponseTxt } from '../../utils/downloadResponseTxt';
import { type DownloadFormat } from '../../components/ui/ChatFooterActions/ChatFooterActions';

// ---- Local types ----
type DocItem = Document & { relativePath?: string };

const Experimentation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { chatbotId } = useParams<{ chatbotId?: string }>();

  const { showNotification } = useNotification();
  const { chatbot, pipelines, updateChatbotPipeline, updateChatbotName, fetchChatbotById } =
    useChatbot();
  const { mode, setMode, currentUser } = useAppContext();

  // Read mode from URL query parameter
  const searchParams = new URLSearchParams(location.search);
  const urlMode = searchParams.get('mode') as 'TalkToDocument' | 'TalkToData' | null;

  // Set mode from URL if available
  useEffect(() => {
    if (urlMode && urlMode !== mode) {
      setMode(urlMode);
    }
  }, [urlMode, mode, setMode]);

  const isCreateMode =
    Boolean((location.state as Record<string, unknown>)?.createNew) && !chatbotId;

  const isoDateOnly = new Date().toISOString().slice(0, 10);

  const chatScrollRef = useRef<HTMLDivElement>(null);

  const [message, setMessage] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  /**
   * Dynamic models (from /api/models)
   */
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [isModelsLoading, setIsModelsLoading] = useState<boolean>(false);

  const [citationsByDoc, setCitationsByDoc] = useState<CitationsMap>({});
  const [documents, setDocuments] = useState<DocItem[]>([]);

  const [selectedPipeline, setSelectedPipeline] = useState<string>('');

  const [modelComparisonData, setModelComparisonData] = useState<ModelComparisonData[]>([]);
  const [isLoadingComparison, setIsLoadingComparison] = useState<boolean>(false);
  const [metricVsScoreData, setMetricVsScoreData] = useState<
    Array<Record<string, number | string>>
  >([]);

  // New: metrics returned by /api/mc/all-metrics
  const [csatScoresRaw, setCsatScoresRaw] = useState<any[]>([]);
  const [recommendedModelNameFromAPI, setRecommendedModelNameFromAPI] = useState<string | null>(
    null
  );
  const [totalConversationsForMC, setTotalConversationsForMC] = useState<number | null>(null);

  const [isDeployDialogOpen, setIsDeployDialogOpen] = useState<boolean>(false);

  // ---- Chat file upload state ----
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [uploadedFileType, setUploadedFileType] = useState<string>('');
  const [uploadedTextContent, setUploadedTextContent] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadedFilePreviewUrl, setUploadedFilePreviewUrl] = useState<string | null>(null);

  const {
    chatbotName,
    isEditingName,
    tempChatbotName,
    handleStartEditingName,
    handleSaveName,
    handleCancelEditingName,
    setTempChatbotName,
  } = useChatbotName(chatbot, updateChatbotName, isoDateOnly);

  const {
    isPipelinePanelExpanded,
    isModelComparisonExpanded,
    handleTogglePipelinePanel,
    handleToggleModelComparison,
    setIsPipelinePanelExpanded,
    setIsModelComparisonExpanded,
    getMainContentStyle,
  } = usePanelState(isCreateMode);

  const getAgentUrl = useMemo(() => {
    const API_BASE = 'http://localhost:5000';
    if (mode === 'TalkToDocument') return `${API_BASE}/api/agent`;
    if (mode === 'TalkToData') return `${API_BASE}/api/structured-agent`;
    return `${API_BASE}/api/agent`;
  }, [mode]);

  const getModeDisplay = useMemo(() => {
    if (mode === 'TalkToDocument') return 'Talk to Document';
    if (mode === 'TalkToData') return 'Talk to Data';
    return 'Application';
  }, [mode]);

  // Normalize selectedModels to handle comma-separated strings
  const normalizedSelectedModels = useMemo(() => {
    if (!selectedModels || !Array.isArray(selectedModels)) return [];
    return selectedModels.flat().flatMap((m) => {
      const str = String(m).trim();
      if (str.includes(',')) {
        return str
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }
      return str.length > 0 ? [str] : [];
    });
  }, [selectedModels]);

  /**
   * Load models from backend and set default selection (1–3)
   */
  useEffect(() => {
    let ignore = false;

    const loadModels = async () => {
      // Only needed for TalkToDocument model picker
      if (mode !== 'TalkToDocument') return;

      setIsModelsLoading(true);
      try {
        const models = await ModelsAPI.getModels();
        if (ignore) return;

        setAvailableModels(models);

        // Keep previous selection if still valid; else prefer Settings defaults from localStorage; then preferred defaults
        setSelectedModels((prev) => {
          // 1) keep still-valid selections from current state
          const prevValid = (prev ?? []).filter((m) => models.includes(m));
          if (prevValid.length > 0) return prevValid.slice(0, MAX_SELECTED_MODELS);

          // 2) try to load persisted defaults from Settings (localStorage)
          try {
            const raw = window.localStorage.getItem('selectedModels');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed) && parsed.length > 0) {
                const storedValid = parsed.filter((m) => models.includes(m));
                if (storedValid.length > 0) return storedValid.slice(0, MAX_SELECTED_MODELS);
              }
            }
          } catch (e) {
            // ignore JSON/localStorage errors
          }

          // 3) Auto-select preferred ids if available
          const preferredIds = ['llama3.1-70b', 'llama3.1-8b', 'mistral-large2'];
          const matched = preferredIds.filter((id) => models.includes(id));
          if (matched.length > 0) return matched.slice(0, MAX_SELECTED_MODELS);

          // 4) otherwise keep empty selection
          return [];
        });
      } catch (err: any) {
        console.error('Failed to load models:', err);
        if (!ignore) {
          setAvailableModels([]);
          setSelectedModels([]);
        }
        showNotification({
          type: 'error',
          message: err?.message ?? 'Failed to load models from /api/models',
          autoHideDuration: 3500,
        });
      } finally {
        if (!ignore) setIsModelsLoading(false);
      }
    };

    loadModels();
    return () => {
      ignore = true;
    };
  }, [mode, showNotification]);

  // Listen for changes to selectedModels made in Settings
  // Only apply Settings defaults for new chatbots (isCreateMode)
  // or when chatbot has no per-chatbot override.
  useEffect(() => {
    const handler = () => {
      try {
        // If this experimentation page is editing an existing chatbot that already has a per-chatbot
        // model override (chatbot.APP_MODEL_NAME), do not override the user's selection here.
        if (!isCreateMode && chatbot?.APP_MODEL_NAME) {
          return;
        }

        const raw = window.localStorage.getItem('selectedModels');
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed) && parsed.length > 0) {
          // only apply models that are currently available
          const valid = parsed
            .filter((m) => availableModels.includes(m))
            .slice(0, MAX_SELECTED_MODELS);
          if (valid.length > 0) setSelectedModels(valid);
        } else {
          // if cleared in Settings, reflect that
          setSelectedModels([]);
        }
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener('selectedModelsChanged', handler);
    return () => window.removeEventListener('selectedModelsChanged', handler);
  }, [availableModels, isCreateMode, chatbot?.APP_MODEL_NAME]);

  // Populate selectedModels from existing chatbot's APP_MODEL_NAME
  useEffect(() => {
    if (!isCreateMode && chatbot?.APP_MODEL_NAME) {
      try {
        let parsed: string[] = [];
        const modelData = chatbot.APP_MODEL_NAME;

        // If it's already an array, use it
        if (Array.isArray(modelData)) {
          parsed = modelData.map((m) => String(m).trim()).filter((m) => m.length > 0);
        } else if (typeof modelData === 'string') {
          // Try parsing as JSON first
          try {
            const jsonParsed = JSON.parse(modelData);
            if (Array.isArray(jsonParsed)) {
              parsed = jsonParsed.map((m) => String(m).trim()).filter((m) => m.length > 0);
            }
          } catch {
            // If JSON parsing fails, treat as comma-separated string
            parsed = modelData
              .split(',')
              .map((m) => m.trim())
              .filter((m) => m.length > 0);
          }
        }

        // Ensure we have individual models, not nested arrays
        parsed = parsed.flat().filter((m) => m.length > 0);

        if (parsed.length > 0) {
          setSelectedModels(parsed);
        }
      } catch (err) {
        console.error('Error parsing models:', err);
      }
    }
  }, [chatbot?.APP_MODEL_NAME, isCreateMode]);

  // Track whether this page was opened from deployed or experiment
  const [openedFromDeployed, setOpenedFromDeployed] = useState<boolean>(false);
  useEffect(() => {
    const state = (location && (location.state as any)) ?? {};
    if (state?.from === 'deployed') {
      try {
        sessionStorage.setItem('experimentation_opened_from', 'deployed');
      } catch {}
      setOpenedFromDeployed(true);
    } else if (state?.from === 'experiment') {
      try {
        sessionStorage.setItem('experimentation_opened_from', 'experiment');
      } catch {}
      setOpenedFromDeployed(false);
    } else {
      try {
        const stored = sessionStorage.getItem('experimentation_opened_from');
        setOpenedFromDeployed(stored === 'deployed');
      } catch {
        setOpenedFromDeployed(false);
      }
    }
  }, [location]);

  // ---- Fetch chatbot from URL parameter if present and not already in context
  useEffect(() => {
    if (chatbotId && !chatbot?.CHATBOT_ID) {
      const loadChatbot = async () => {
        try {
          await fetchChatbotById(Number(chatbotId));
        } catch (error) {
          console.error('Error fetching chatbot from URL:', error);
          showNotification({
            type: 'error',
            message: 'Failed to load chatbot. Please try again.',
            autoHideDuration: 3000,
          });
        }
      };
      loadChatbot();
    }
  }, [chatbotId, chatbot?.CHATBOT_ID, fetchChatbotById, showNotification]);

  // ---- Citations coming from useAgentStreaming
  const handleCitationsUpdate = useCallback((citations: CitationsMap) => {
    setCitationsByDoc((prev) => ({ ...prev, ...citations }));
  }, []);

  const handleShowWarning = useCallback(
    (msg: string) => {
      showNotification({
        type: 'warning',
        message: msg,
        onCancel: () => {},
        autoHideDuration: null,
      });
    },
    [showNotification]
  );

  // Effective chatbot ID: URL param is the source of truth, context is fallback
  const effectiveChatbotId = chatbotId ? Number(chatbotId) : chatbot?.CHATBOT_ID;

  // ---- Talk to Document (unstructured) streaming
  const agentStreamingResult = useAgentStreaming({
    chatbotId: effectiveChatbotId,
    agentUrl: getAgentUrl,
    models: normalizedSelectedModels.map((id) => ({ modelId: id })),
    onCitationsUpdate: handleCitationsUpdate,
    showWarning: handleShowWarning,
    pipelineId: selectedPipeline,
  });

  // ---- Talk to Data (structured) streaming
  const structuredAgentResult = useStructuredAgent({
    chatbotId: effectiveChatbotId,
    agentUrl: getAgentUrl,
    models: normalizedSelectedModels.map((id) => ({ modelId: id })),
    showWarning: handleShowWarning,
  });

  // Choose which result to render based on mode
  const {
    chatHistory,
    handleSend: sendMessage,
    setChatHistory,
    isLoading,
    stopGeneration,
  } = mode === 'TalkToData' ? structuredAgentResult : agentStreamingResult;

  const structuredData = mode === 'TalkToData' ? structuredAgentResult.structuredData : undefined;
  const setStructuredData = structuredAgentResult.setStructuredData;

  const scrollToBottom = useCallback(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, []);

  // ---- Fetch existing chat history (not streaming)
  const fetchChatHistory = useCallback(async () => {
    if (!effectiveChatbotId || isCreateMode) return;

    try {
      const rows = await ChatbotAPI.getResponses(effectiveChatbotId);

      // Group rows by question to reconstruct multi-model responses.
      // Backend saves one row per model per question; we need to merge them back.
      const grouped: Array<{ user: string; bot: Record<string, string>; thinking?: string }> = [];

      for (const row of rows) {
        const question = row.USER_MESSAGE;
        const modelName = row.MODEL_NAME || 'default';
        const botMessage = String(row.BOT_MESSAGE ?? '');
        const thinking = row.THINKINGDESC ?? undefined;

        // Check if the last group has the same question (multi-model responses are saved sequentially)
        const lastGroup = grouped[grouped.length - 1];
        if (lastGroup && lastGroup.user === question && !lastGroup.bot[modelName]) {
          // Same question, different model — add to existing group
          lastGroup.bot[modelName] = botMessage;
          if (thinking && !lastGroup.thinking) {
            lastGroup.thinking = thinking;
          }
        } else {
          // New question or same question asked again (same model already exists)
          grouped.push({
            user: question,
            bot: { [modelName]: botMessage },
            thinking,
          });
        }
      }

      // Ensure all selected model keys exist in each group (for UI tab rendering)
      const history = grouped.map((item) => {
        if (normalizedSelectedModels.length > 0) {
          const fullBot: Record<string, string> = {};
          for (const modelId of normalizedSelectedModels) {
            fullBot[modelId] = item.bot[modelId] || item.bot['default'] || '';
          }
          // Also preserve responses from models not in current selection
          for (const [key, val] of Object.entries(item.bot)) {
            if (!(key in fullBot) && key !== 'default') {
              fullBot[key] = val;
            }
          }
          return { user: item.user, bot: fullBot, thinking: item.thinking };
        }
        // Single model or no models selected — use first available response
        const firstResponse = Object.values(item.bot)[0] || '';
        return { user: item.user, bot: firstResponse, thinking: item.thinking };
      });

      setChatHistory(history as ChatItem[]);
    } catch (error) {
      console.error('Error fetching chat history:', error);
    }
  }, [effectiveChatbotId, isCreateMode, normalizedSelectedModels, setChatHistory]);

  // pipeline id -> UI state
  useEffect(() => {
    if (isCreateMode) setSelectedPipeline('');
    else if (chatbot?.PIPELINE_ID) setSelectedPipeline(chatbot.PIPELINE_ID);
  }, [chatbot, isCreateMode]);

  // clear 'createNew' from route state once saved
  useEffect(() => {
    if (location.state?.createNew && chatbot?.CHATBOT_ID) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [chatbot?.CHATBOT_ID, location.state, location.pathname, navigate]);

  // Load chat history on open (wait until models are loaded for proper tab rendering)
  useEffect(() => {
    if (!effectiveChatbotId || isCreateMode) return;
    // For TalkToDocument, wait until models are available so tabs render properly
    if (mode === 'TalkToDocument' && (isModelsLoading || normalizedSelectedModels.length === 0))
      return;
    fetchChatHistory();
  }, [
    effectiveChatbotId,
    isCreateMode,
    isModelsLoading,
    normalizedSelectedModels,
    mode,
    fetchChatHistory,
  ]);

  // Keep view scrolled
  useEffect(() => {
    const timer = setTimeout(() => scrollToBottom(), 100);
    return () => clearTimeout(timer);
  }, [chatHistory, scrollToBottom]);

  // ---- Handle file upload from ChatInput + button ----
  const handleFileSelect = useCallback(
    async (file: File) => {
      if (isUploading) return;

      // Generate preview URL for image files
      if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file);
        setUploadedFilePreviewUrl(previewUrl);
      } else {
        setUploadedFilePreviewUrl(null);
      }

      setIsUploading(true);
      setUploadedFileName(file.name);
      try {
        const result = await PipelineAPI.uploadChatDocument(file);
        setUploadedFileName(result.file_name);
        setUploadedFileType(result.file_type);
        setUploadedTextContent(result.text_content || '');
        showNotification({
          type: 'success',
          message: `Uploaded "${result.file_name}" successfully.`,
          autoHideDuration: 3000,
        });
      } catch (err: any) {
        console.error('Chat document upload error:', err);
        showNotification({
          type: 'error',
          message: err?.message ?? 'Failed to upload document.',
          autoHideDuration: 3500,
        });
        setUploadedFileName('');
        setUploadedFileType('');
        setUploadedTextContent('');
        if (uploadedFilePreviewUrl) {
          URL.revokeObjectURL(uploadedFilePreviewUrl);
        }
        setUploadedFilePreviewUrl(null);
      } finally {
        setIsUploading(false);
      }
    },
    [isUploading, showNotification, uploadedFilePreviewUrl]
  );

  const handleClearFile = useCallback(() => {
    setUploadedFileName('');
    setUploadedFileType('');
    setUploadedTextContent('');
    if (uploadedFilePreviewUrl) {
      URL.revokeObjectURL(uploadedFilePreviewUrl);
    }
    setUploadedFilePreviewUrl(null);
  }, [uploadedFilePreviewUrl]);

  // Send handler with model guardrails for TalkToDocument
  const handleSendWrapper = useCallback(async () => {
    if (!message.trim()) return;
    if (isGenerating) return;

    if (mode === 'TalkToDocument') {
      if (isModelsLoading) {
        showNotification({
          type: 'warning',
          message: 'Models are still loading…',
          autoHideDuration: 2000,
        });
        return;
      }
      if (!normalizedSelectedModels || normalizedSelectedModels.length === 0) {
        showNotification({
          type: 'warning',
          message: 'Please select at least one model.',
          autoHideDuration: 2500,
        });
        return;
      }
    }

    try {
      const messageToSend = message;

      // If a file was uploaded, route based on mode
      if (uploadedFileName) {
        setIsGenerating(true);
        setMessage('');
        setChatHistory((prev) => [...prev, { user: messageToSend, bot: '' }]);

        try {
          if (mode === 'TalkToData') {
            // ---- Talk to Data: structured PDF analysis (populates 4 tabs) ----
            const userNameStr = String(getSignedInUserId() ?? '');
            const apiParams = {
              file_name: uploadedFileName,
              file_type: uploadedFileType,
              user_instruction: messageToSend,
              user_name: userNameStr,
            };

            const result = await PipelineAPI.processUploadedDataAnalysis(apiParams);

            // Update chat history with the answer text
            const botResponse = result.answerText || result.planningText || 'Analysis complete.';
            setChatHistory((prev) => {
              const updated = [...prev];
              const idx = updated.length - 1;
              updated[idx] = { user: messageToSend, bot: botResponse };

              // Populate structuredData for the 4 tabs
              setStructuredData((prevMap) => {
                const newMap = new Map(prevMap);
                newMap.set(idx, {
                  sql: result.sql || '',
                  rows: result.rows || [],
                  chartSpec: result.chartSpec || undefined,
                  agent: result.agent || '',
                  queryId: result.queryId || undefined,
                  queryIdVerified: result.queryIdVerified || false,
                  planningSteps: result.planningText || '',
                });
                return newMap;
              });

              return updated;
            });
          } else {
            // ---- Talk to Document: multi-model PDF analysis (free-text) ----
            const userNameStr = String(getSignedInUserId() ?? '');
            const apiParams: {
              file_name: string;
              file_type: string;
              user_instruction: string;
              user_name: string;
              models: string;
              text_content?: string;
            } = {
              file_name: uploadedFileName,
              file_type: uploadedFileType,
              user_instruction: messageToSend,
              user_name: userNameStr,
              models: normalizedSelectedModels.join(','),
            };
            if (uploadedTextContent) {
              apiParams.text_content = uploadedTextContent;
            }

            const result = await PipelineAPI.processUploadedChatMultiModel(apiParams);
            const data = result.data;

            // Extract actual response text from the data structure
            let botResponse: string | Record<string, string> = '';

            if (data && typeof data === 'object') {
              const responses = data.responses;
              if (responses && typeof responses === 'object' && Object.keys(responses).length > 0) {
                botResponse = responses as Record<string, string>;
              } else {
                botResponse =
                  typeof data === 'string' ? data : 'No response received from the model.';
              }
            } else if (typeof data === 'string') {
              botResponse = data;
            } else {
              botResponse = 'No response received from the model.';
            }

            setChatHistory((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { user: messageToSend, bot: botResponse };
              return updated;
            });
          }
        } catch (err: any) {
          console.error('Process uploaded chat error:', err);
          setChatHistory((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              user: messageToSend,
              bot: `Error: ${err?.message ?? 'Failed to process document.'}`,
            };
            return updated;
          });
        }

        // Clear file after sending
        setUploadedFileName('');
        setUploadedFileType('');
        if (uploadedFilePreviewUrl) {
          URL.revokeObjectURL(uploadedFilePreviewUrl);
        }
        setUploadedFilePreviewUrl(null);
      } else {
        await sendMessage(messageToSend, () => setMessage(''));
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsGenerating(false);
    }
  }, [
    message,
    isGenerating,
    sendMessage,
    mode,
    isModelsLoading,
    normalizedSelectedModels,
    showNotification,
    uploadedFileName,
    uploadedFileType,
    uploadedTextContent,
    uploadedFilePreviewUrl,
    setChatHistory,
    setStructuredData,
  ]);

  // Inline feedback from chat bubbles
  const handleFeedback = useCallback(
    async (rating01: 1 | 0, payload: { question: string; response: string }) => {
      if (!chatbot?.CHATBOT_ID) return;

      const { question, response } = payload;
      const responseId = await resolveResponseId(chatbot.CHATBOT_ID, question, response);

      try {
        await ChatbotAPI.saveFeedbackREST({
          responseId,
          chatbotId: chatbot.CHATBOT_ID,
          rating01,
          question,
          response,
          userId: getSignedInUserId(),
          modelName: null,
        });
      } catch (err) {
        console.error('Failed to save feedback:', err);
      }
    },
    [chatbot?.CHATBOT_ID]
  );

  // Download active response in chosen format (safe export: no model name, no thinking details)
  const handleDownload = useCallback(
    (payload: { question: string; response: string; format: DownloadFormat; modelResponses?: Array<{ modelName: string; response: string }> }) => {
      const commonPayload = {
        question: payload.question,
        response: payload.response,
        generatedAt: new Date().toLocaleString(),
        userName: currentUser?.USERNAME || '',
        modelResponses: payload.modelResponses,
      };

      switch (payload.format) {
        case 'pdf':
          downloadResponsePdf(commonPayload);
          break;
        case 'docx':
        case 'doc':
          downloadResponseDocx({ ...commonPayload, fileExtension: payload.format });
          break;
        case 'txt':
          downloadResponseTxt(commonPayload);
          break;
      }
    },
    [currentUser]
  );

  const handleCreatePipeline = useCallback(async () => {}, []);

  const handlePipelineSelect = useCallback(
    (pipelineId: string) => {
      setSelectedPipeline(pipelineId);
      updateChatbotPipeline(pipelineId);
    },
    [updateChatbotPipeline]
  );

  // Fetch metrics for Model Comparison panel
  const fetchMetrics = useCallback(async () => {
    setIsLoadingComparison(true);
    try {
      const API_BASE = 'http://localhost:5000';
      const modelsParam = normalizedSelectedModels.length > 0
        ? normalizedSelectedModels.join(',')
        : 'ALL';
      const resp = await fetch(`${API_BASE}/api/mc/all-metrics?models=${encodeURIComponent(modelsParam)}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const json = await resp.json();

      // Expecting shape: { csat_scores: [...], model_comparison: [...], models_tested, recommended_model, total_conversations }
      const mc = Array.isArray(json.model_comparison) ? json.model_comparison : [];

      const transformedForPanel: ModelComparisonData[] = mc.map((m: any) => ({
        modelName: String(m.model ?? m.model_name ?? m.MODEL ?? ''),
        response: '',
        metrics: {
          latency: Number(m.avg_latency_ms ?? 0),
          inputTokens: Number(m.avg_token_count ?? 0),
          outputTokens: 0,
          totalCost: 0,
          totalConversations: Number(m.total_conversations ?? 0),
          successRate: Number(m.success_rate ?? m.successRate ?? 0),
        },
      }));

      setModelComparisonData(transformedForPanel);

      const metricVsScore = [
        {
          name: 'Answer relevance',
          ...Object.fromEntries(
            mc.map((r: any) => [
              String(r.model ?? r.model_name ?? r.MODEL ?? ''),
              Number(r.avg_answer_relevance ?? 0),
            ])
          ),
        },
        {
          name: 'Context relevance',
          ...Object.fromEntries(
            mc.map((r: any) => [
              String(r.model ?? r.model_name ?? r.MODEL ?? ''),
              Number(r.avg_context_relevance ?? 0),
            ])
          ),
        },
        {
          name: 'Groundedness',
          ...Object.fromEntries(
            mc.map((r: any) => [
              String(r.model ?? r.model_name ?? r.MODEL ?? ''),
              Number(r.avg_groundedness ?? 0),
            ])
          ),
        },
        {
          name: 'Correctness',
          ...Object.fromEntries(
            mc.map((r: any) => [
              String(r.model ?? r.model_name ?? r.MODEL ?? ''),
              Number(r.avg_correctness ?? 0),
            ])
          ),
        },
        {
          name: 'Coherence',
          ...Object.fromEntries(
            mc.map((r: any) => [
              String(r.model ?? r.model_name ?? r.MODEL ?? ''),
              Number(r.avg_coherence ?? 0),
            ])
          ),
        },
      ];
      setMetricVsScoreData(metricVsScore);

      // store csat scores + totals in local state to pass to panel via props
      // Build per-model CSAT from model_comparison entries (each has csat_score)
      const perModelCsat = mc.map((m: any) => ({
        model: String(m.model ?? m.model_name ?? m.MODEL ?? ''),
        csat_pct: Number(m.csat_score ?? 0),
      }));
      setCsatScoresRaw(perModelCsat);
      setTotalConversationsForMC(json.total_conversations ?? json.totalConversations ?? null);
      setRecommendedModelNameFromAPI(json.recommended_model ?? json.recommendedModel ?? null);
    } catch (err) {
      console.error('Error fetching model metrics:', err);
      alert('Failed to fetch model metrics.');
    } finally {
      setIsLoadingComparison(false);
    }
  }, [normalizedSelectedModels]);

  const handleModelComparison = useCallback(async () => {
    setIsPipelinePanelExpanded(false);
    setIsModelComparisonExpanded(true);
    await fetchMetrics();
  }, [fetchMetrics, setIsPipelinePanelExpanded, setIsModelComparisonExpanded]);

  // Build `documents` from citation keys + enrich relativePath
  useEffect(() => {
    // Convert citation map keys → Document[] for the right panel
    const baseDocs: DocItem[] = Object.keys(citationsByDoc).map((name) => ({
      name,
      url: '',
    }));
    setDocuments(baseDocs);

    // Enrich each doc with relativePath from /api/response
    const enrich = async () => {
      try {
        const API_BASE = 'http://localhost:5000';
        const resp = await fetch(`${API_BASE}/api/response`);
        if (!resp.ok) return;

        const { data } = await resp.json();
        const nameToPath = new Map<string, string>(
          (data ?? []).map((d: any) => [String(d.fileName), String(d.relativePath)])
        );

        setDocuments((prev) =>
          prev.map((doc) => ({
            ...doc,
            relativePath: nameToPath.get(doc.name) ?? doc.relativePath,
          }))
        );
      } catch {
        // silently ignore enrichment failures
      }
    };

    enrich();
  }, [citationsByDoc]);

  return (
    <div
      className={`${styles.container} ${isModelComparisonExpanded ? 'modelComparisonEnabled' : ''}`}
    >
      <div className={styles.mainContent} style={getMainContentStyle()}>
        <ChatHeader modeDisplay={getModeDisplay} />

        {chatHistory.length === 0 && (
          <BotIntroSection
            chatbotName={chatbotName}
            isEditingName={isEditingName}
            tempChatbotName={tempChatbotName}
            isCreateMode={isCreateMode}
            onStartEditing={handleStartEditingName}
            onSaveName={handleSaveName}
            onCancelEditing={handleCancelEditingName}
            onTempNameChange={setTempChatbotName}
          />
        )}

        {mode === 'TalkToData' ? (
          <>
            <ChatDataHistoryDisplay
              chatHistory={chatHistory}
              structuredData={structuredData}
              onFeedback={handleFeedback}
              scrollRef={chatScrollRef}
            />

            {isGenerating && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  color: '#666',
                }}
              >
                <CircularProgress size={20} />
                <span style={{ fontSize: '0.875rem' }}>Generating response…</span>
              </div>
            )}
          </>
        ) : (
          <>
            <ChatHistoryDisplay
              chatHistory={chatHistory}
              models={normalizedSelectedModels.map((id) => ({
                label: MODEL_ID_TO_LABEL[id] ?? id,
                value: id,
              }))}
              onFeedback={handleFeedback}
              onDownload={handleDownload}
              scrollRef={chatScrollRef}
            />

            {isGenerating && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 12px',
                  color: '#666',
                }}
              >
                <CircularProgress size={20} />
                <span style={{ fontSize: '0.875rem' }}>Generating response…</span>
              </div>
            )}
          </>
        )}

        {chatHistory.length > 0 && (
          <ChatBottomActions
            showModelComparison={mode === 'TalkToDocument' && !openedFromDeployed}
            showDeploy={
              !(openedFromDeployed && (mode === 'TalkToData' || mode === 'TalkToDocument'))
            }
            onModelComparison={mode === 'TalkToDocument' ? handleModelComparison : undefined}
            onDeploy={() => setIsDeployDialogOpen(true)}
          />
        )}

        <div className={styles.chatInputWrapper}>
          <ChatInput
            value={message}
            onChange={setMessage}
            onSend={handleSendWrapper}
            onStop={stopGeneration}
            isRunning={isLoading}
            placeholder="Ask your question"
            disabled={isLoading}
            onFileSelect={handleFileSelect}
            uploadedFileName={uploadedFileName}
            uploadedFilePreviewUrl={uploadedFilePreviewUrl}
            onClearFile={handleClearFile}
            isUploading={isUploading}
          />
        </div>
      </div>

      {/* Left side panel: Pipelines / Models / Referred Documents */}
      <SidePanel
        title="Pipeline Selection"
        isExpanded={isPipelinePanelExpanded}
        onToggle={handleTogglePipelinePanel}
      >
        <PipelinePanel
          pipeline={selectedPipeline}
          pipelines={pipelines}
          onSelect={handlePipelineSelect}
          onCreatePipeline={handleCreatePipeline}
          chatbotName={chatbotName}
          isCreateMode={isCreateMode}
          documents={documents}
          mode={mode}
          openedFromDeployed={openedFromDeployed}
          availableModels={availableModels}
          selectedModels={selectedModels}
          onModelsChange={setSelectedModels}
        />
      </SidePanel>

      {/* Right side panel: Model Comparison */}
      {isModelComparisonExpanded && (
        <SidePanel
          title="Model Comparison"
          isExpanded={isModelComparisonExpanded}
          onToggle={handleToggleModelComparison}
          className={styles.modelComparisonPanel}
        >
          <ModelComparisonPanel
            data={modelComparisonData}
            isLoading={isLoadingComparison}
            metricVsScoreData={metricVsScoreData}
            csatScores={csatScoresRaw}
            totalConversations={totalConversationsForMC}
            recommendedModel={recommendedModelNameFromAPI}
          />
        </SidePanel>
      )}

      {/* Deploy dialog */}
      {chatbot && (
        <ModelDeployDialog
          open={isDeployDialogOpen}
          onClose={() => setIsDeployDialogOpen(false)}
          onConfirm={() => {
            navigate('/deployed-application');
          }}
          chatbot={chatbot}
          availableModels={availableModels}
        />
      )}
    </div>
  );
};

export default Experimentation;
