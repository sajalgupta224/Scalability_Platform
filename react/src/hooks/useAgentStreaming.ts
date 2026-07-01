import { useState, useRef, useCallback } from 'react';
import type { ChatItem } from '../types/pages.types';
import type { CitationsMap } from '../types/citations.types';
import { ChatbotAPI } from '../api/endpoints/chatbot.api';
import { toStackedList, normalizeBotText } from '../utils/textUtils';
import { countTokensApprox } from '../utils/tokenUtils';
import { getSignedInUserId } from '../utils/sessionUtils';
import { GENERATING_TEXT } from '../constants/chatUi';

interface UseAgentStreamingProps {
  chatbotId: number | undefined;
  agentUrl: string;
  models: Record<string, unknown>[];
  onCitationsUpdate: (citations: CitationsMap) => void;
  showWarning: (message: string) => void;
  pipelineId?: string;
}

interface UseAgentStreamingReturn {
  chatHistory: ChatItem[];
  currentQuestion: string;
  isLoading: boolean;
  handleSend: (message: string, onMessageCleared?: () => void) => Promise<void>;
  setChatHistory: React.Dispatch<React.SetStateAction<ChatItem[]>>;
  stopGeneration: () => void;
}

const asModelMap = (
  text: string,
  models: Record<string, unknown>[]
): Record<string, string> => {
  return models.reduce((acc: Record<string, string>, m: Record<string, unknown>) => {
    const id =
      (typeof (m as any)?.modelId === 'string' && (m as any).modelId) ||
      (typeof (m as any)?.value === 'string' && (m as any).value) ||
      'default';

    acc[id] = text ?? 'No response';
    return acc;
  }, {});
};

const keyOf = (q: string, r: string) => `${q}@@${r}`;

async function resolveResponseId(
  chatbotId: number,
  question: string,
  response: string
): Promise<number | null> {
  try {
    const rows = await ChatbotAPI.getResponses(chatbotId);
    const match = rows.find(
      (r) =>
        String(r.USER_MESSAGE) === String(question) &&
        String(r.BOT_MESSAGE) === String(response)
    );
    return match?.RESPONSE_ID ?? null;
  } catch {
    return null;
  }
}

/* ──────────────────────────────────────────────────────────────
   DeepSeek R1: stream‑safe <think>…</think> remover
   - Handles raw and HTML-escaped forms
   - Keeps a small tail to catch boundary splits
────────────────────────────────────────────────────────────── */

const stripThinkBlocksOnce = (text: string): string => {
  if (!text) return '';
  let out = String(text);

  // Remove full closed blocks
  const blocks: RegExp[] = [
    /<\s*think\b[^>]*>[\s\S]*?<\s*\/\s*think\s*>/gi,
    /&lt;\s*think\b[^&]*&gt;[\s\S]*?&lt;\s*\/\s*think\s*&gt;/gi,
  ];
  for (const re of blocks) out = out.replace(re, '');

  // Remove leftover lone tags (preserve subsequent content)
  const strays: RegExp[] = [
    /<\s*think\b[^>]*>/gi,
    /<\s*\/\s*think\s*>/gi,
    /&lt;\s*think\b[^&]*&gt;/gi,
    /&lt;\s*\/\s*think\s*&gt;/gi,
  ];
  for (const re of strays) out = out.replace(re, '');

  return out;
};

type ThinkSanitizer = {
  next: (chunk: string) => string; // returns safe-to-append text
  flush: () => string;             // returns any trailing safe text
};

const makeThinkStripperStreamSafe = (): ThinkSanitizer => {
  let buffer = '';

  const next = (chunk: string): string => {
    buffer += chunk;

    // Remove any complete think blocks now present
    buffer = stripThinkBlocksOnce(buffer);

    // Keep a safe tail to avoid slicing potential partial tags
    const SAFE_TAIL = 64;
    if (buffer.length <= SAFE_TAIL) return '';

    const emit = buffer.slice(0, buffer.length - SAFE_TAIL);
    buffer = buffer.slice(buffer.length - SAFE_TAIL);

    // Clean any stray closing tags that might have completed in the emitted slice
    let cleaned = emit;
    const closers: RegExp[] = [
      /<\s*\/\s*think\s*>/gi,
      /&lt;\s*\/\s*think\s*&gt;/gi,
    ];
    for (const re of closers) cleaned = cleaned.replace(re, '');

    return cleaned;
  };

  const flush = (): string => {
    const tail = stripThinkBlocksOnce(buffer);
    buffer = '';
    return tail;
  };

  return { next, flush };
};

export const useAgentStreaming = ({
  chatbotId,
  agentUrl,
  models,
  onCitationsUpdate,
  showWarning,
  pipelineId,
}: UseAgentStreamingProps): UseAgentStreamingReturn => {
  const [chatHistory, setChatHistory] = useState<ChatItem[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const savedIdsRef = useRef<Map<string, number>>(new Map());
  const normalizedMessagesRef = useRef<Set<number>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  // Per-model stream sanitizers (initialized to empty object to avoid TS2532)
  const thinkSanitizersRef = useRef<Record<string, ThinkSanitizer>>({});

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  }, []);

  const handleSend = async (message: string, onMessageCleared?: () => void) => {
    if (!message.trim()) return;
    if (!chatbotId) {
      showWarning('Please create the chatbot before sending messages.');
      return;
    }

    try {
      setIsLoading(true);

      if (onMessageCleared) onMessageCleared();

      setCurrentQuestion(message);

      setChatHistory(
        (prev) => [...prev, { user: message, bot: asModelMap(GENERATING_TEXT, models) }] as ChatItem[]
      );

      // -------------------------------------------------------------------
      // Build selected_models as CSV string + a Set for quick checks
      // -------------------------------------------------------------------
      const selectedModelsString = models
        .map((m: any) => m?.modelId)
        .filter(Boolean)
        .join(',');
      const selectedModelsSet = new Set(
        selectedModelsString.split(',').map((s) => s.trim()).filter(Boolean)
      );

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const agentResponse = await fetch(agentUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: message,
          selected_models: selectedModelsString,
          pipeline_id: pipelineId || undefined,
        }),
        signal: controller.signal,
      });

      if (!agentResponse.ok) {
        throw new Error(`Failed to call agent API: ${agentResponse.status} ${agentResponse.statusText}`);
      }
      if (!agentResponse.body) {
        throw new Error('Response body is null – streaming not available');
      }

      const reader = agentResponse.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedThinking = '';
      const perModel: Record<string, string> = {};

      let rafId: number | null = null;
      let pendingUpdate = false;

      const scheduleUpdate = () => {
        if (pendingUpdate) return;
        pendingUpdate = true;

        if (rafId !== null) cancelAnimationFrame(rafId);

        rafId = requestAnimationFrame(() => {
          setChatHistory((prev) => {
            const updated = [...prev];

            if (updated.length === 0) {
              updated.push({
                user: currentQuestion || message,
                bot: asModelMap(GENERATING_TEXT, models),
              } as ChatItem);
            }

            const last = updated[updated.length - 1];

            if (last) {
              if (Object.keys(perModel).length > 0) {
                last.bot = { ...asModelMap('', models), ...perModel } as Record<string, string>;
              } else {
                last.bot = asModelMap(GENERATING_TEXT, models) as Record<string, string>;
              }
            }

            return updated;
          });

          pendingUpdate = false;
          rafId = null;
        });
      };

      const getThinkSanitizer = (model: string): ThinkSanitizer => {
        const key = model.toLowerCase();
        return (thinkSanitizersRef.current[key] ||= makeThinkStripperStreamSafe());
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk
          .split('\n')
          .map((s) => s.trim())
          .filter(Boolean);

        for (const line of lines) {
          if (!line.startsWith('data:')) continue;
          const raw = line.slice(5).trim();
          if (raw === '[DONE]') continue;

          try {
            const payload = JSON.parse(raw);

            // -------------------------------------------------------------------
            // CITATIONS
            // -------------------------------------------------------------------
            if (Array.isArray(payload?.documents)) {
              console.log('[CITATION-FRONTEND] Received documents event:', payload.documents);
              const map: CitationsMap = {};
              payload.documents.forEach((d: any) => {
                if (typeof d === 'string' && d.trim()) {
                  map[d.trim()] = { citations: {} };
                } else if (d && typeof d.name === 'string' && d.name.trim()) {
                  map[d.name.trim()] = { citations: {} };
                }
              });
              if (Object.keys(map).length > 0) {
                console.log('[CITATION-FRONTEND] Calling onCitationsUpdate with:', Object.keys(map));
                onCitationsUpdate(map);
              }
              continue;
            }

            // -------------------------------------------------------------------
            // Skip model announcement event from backend (not actual content)
            // -------------------------------------------------------------------
            if (Array.isArray(payload?.selected_models)) {
              continue;
            }

            // -------------------------------------------------------------------
            // Per-model responses
            // -------------------------------------------------------------------
            if (typeof payload?.model === 'string' && typeof payload?.text === 'string') {
              const model = payload.model;
              let delta = payload.text;

              if (model.toLowerCase() === 'deepseek-r1') {
                const san = getThinkSanitizer(model);
                const safe = san.next(delta);
                if (safe) {
                  perModel[model] = (perModel[model] || '') + toStackedList(safe);
                  scheduleUpdate();
                }
              } else {
                perModel[model] = (perModel[model] || '') + toStackedList(delta);
                scheduleUpdate();
              }
              continue;
            }

            // -------------------------------------------------------------------
            // Thinking deltas (no model) — keep as-is for the details panel
            // -------------------------------------------------------------------
            if (typeof payload?.text === 'string') {
              accumulatedThinking += payload.text;
              scheduleUpdate();
              continue;
            }

            // Status-only
            if (payload?.status && payload?.message && !payload?.text) {
              continue;
            }

            // Fallback to raw text if nothing matched
            const txt = typeof raw === 'string' ? raw : JSON.stringify(payload);
            if (Object.keys(perModel).length === 0) {
              accumulatedThinking += txt;
              scheduleUpdate();
            }
          } catch {
            if (Object.keys(perModel).length === 0) {
              accumulatedThinking += raw;
              scheduleUpdate();
            }
          }
        }
      }

      if (rafId !== null) cancelAnimationFrame(rafId);

      // Flush any remaining deepseek-r1 tail
      const dsSan = thinkSanitizersRef.current['deepseek-r1'];
      if (dsSan) {
        const tail = dsSan.flush();
        if (tail) {
          perModel['deepseek-r1'] = (perModel['deepseek-r1'] || '') + toStackedList(tail);
        }
      }

      // Finalize UI state & normalize
      console.log('[DEBUG-MODELS] perModel keys:', Object.keys(perModel), 'lengths:', Object.fromEntries(Object.entries(perModel).map(([k,v]) => [k, v.length])));
      setChatHistory((prev) => {
        const updated = [...prev];
        if (updated.length === 0) {
          updated.push({ user: currentQuestion || message, bot: asModelMap('', models) } as ChatItem);
        }

        const last = updated[updated.length - 1];
        const lastIndex = updated.length - 1;

        if (last) {
          // If no perModel output, sanitize the combined text if deepseek was selected
          const isDeepSeekSelected = [...selectedModelsSet].some((m) => m.toLowerCase() === 'deepseek-r1');
          const defaultTextRaw = isDeepSeekSelected
            ? stripThinkBlocksOnce(accumulatedThinking || '')
            : (accumulatedThinking || '');

          const rawBot =
            Object.keys(perModel).length > 0
              ? { ...asModelMap('No response', models), ...perModel }
              : asModelMap(defaultTextRaw || 'No response', models);

          const normalizedBot: Record<string, string> = {};
          Object.entries(rawBot).forEach(([model, text]) => {
            normalizedBot[model] = normalizeBotText(text);
          });

          last.bot = normalizedBot;

          // Keep the "Thinking" details as provided (not stripped)
          if (accumulatedThinking && accumulatedThinking.trim().length > 0) {
            last.thinking = accumulatedThinking;
          }
          normalizedMessagesRef.current.add(lastIndex);
        }

        return updated;
      });

      // Save responses (deepseek already sanitized in perModel/default path)
      const QUESTION = message;
      const CHATBOT_ID = chatbotId!; // guaranteed non-null after guard at top
      const USER_ID: number | null = getSignedInUserId();

      // Backend enforces MAX_STR = 20000 for question/response/thinkingdesc
      const MAX_SAVE_LEN = 19500;
      const truncate = (s: string) => s.length > MAX_SAVE_LEN ? s.slice(0, MAX_SAVE_LEN) : s;
      const thinkingForSave = accumulatedThinking ? truncate(accumulatedThinking) : null;

      console.log('[SAVE-DEBUG] Attempting save:', { CHATBOT_ID, QUESTION, perModelKeys: Object.keys(perModel), perModelLengths: Object.fromEntries(Object.entries(perModel).map(([k,v]) => [k, v.length])), accumulatedThinkingLen: accumulatedThinking.length });

      try {
        if (Object.keys(perModel).length > 0) {
          console.log('[SAVE-DEBUG] Saving per-model responses for', Object.keys(perModel).length, 'models');
          const savePromises = Object.entries(perModel).map(([modelName, text]) =>
            ChatbotAPI.saveResponseREST({
              chatbotId: CHATBOT_ID,
              modelName,
              question: QUESTION,
              response: truncate(text),
              tokenCount: countTokensApprox(text),
              userId: USER_ID,
              thinking: thinkingForSave,
            }).then((res) => {
              const rid = res?.response_id ?? null;
              if (rid != null) savedIdsRef.current.set(keyOf(QUESTION, text), rid);

              if (res?.thinkingdesc_stored || res?.thinkingdesc_sent) {
                const thinkingText = res.thinkingdesc_stored ?? res.thinkingdesc_sent ?? null;
                if (thinkingText) {
                  setChatHistory((prev) => {
                    const updated = [...prev];
                    const idx = Math.max(0, updated.length - 1);
                    if (updated[idx]) {
                      updated[idx] = { ...updated[idx], thinking: thinkingText };
                    }
                    return updated;
                  });
                }
              }
            })
          );
          await Promise.allSettled(savePromises);
        } else {
          const finalTextRaw = [...selectedModelsSet].some((m) => m.toLowerCase() === 'deepseek-r1')
            ? stripThinkBlocksOnce(accumulatedThinking || '')
            : (accumulatedThinking || '');
          const res = await ChatbotAPI.saveResponseREST({
            chatbotId: CHATBOT_ID,
            modelName: 'default',
            question: QUESTION,
            response: truncate(finalTextRaw || 'No response'),
            tokenCount: countTokensApprox(finalTextRaw || ''),
            userId: USER_ID,
            thinking: thinkingForSave,
          });
          const rid = res?.response_id ?? null;
          if (rid != null) savedIdsRef.current.set(keyOf(QUESTION, finalTextRaw || ''), rid);

          const thinkingText = res?.thinkingdesc_stored ?? res?.thinkingdesc_sent ?? null;
          if (thinkingText) {
            setChatHistory((prev) => {
              const updated = [...prev];
              const idx = Math.max(0, updated.length - 1);
              if (updated[idx]) {
                updated[idx] = { ...updated[idx], thinking: thinkingText };
              }
              return updated;
            });
          }
        }
      } catch (saveErr) {
        console.error('[SAVE-DEBUG] FAILED to save chatbot response(s):', saveErr);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        // User stopped generation – update last message to show partial content
        setChatHistory((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last) {
            const currentBot = last.bot as Record<string, string>;
            const hasContent = Object.values(currentBot).some(
              (v) => v && v !== GENERATING_TEXT
            );
            if (!hasContent) {
              last.bot = asModelMap('Generation stopped.', models) as Record<string, string>;
            }
          }
          return updated;
        });
        return;
      }

      console.error('Error sending message:', error);

      setChatHistory((prev) => {
        const updated = [...prev];
        if (updated.length === 0) {
          updated.push({ user: currentQuestion || message, bot: asModelMap('', models) } as ChatItem);
        }
        const last = updated[updated.length - 1];
        if (last) {
          last.bot = asModelMap('Something went wrong. Please try again later.', models) as Record<
            string,
            string
          >;
        }
        return updated;
      });

      if (chatbotId) {
        try {
          const errText = 'Error: agent invocation failed';
          const rid = await ChatbotAPI.saveResponseREST({
            chatbotId: chatbotId,
            modelName: 'default',
            question: currentQuestion || message,
            response: errText,
            tokenCount: countTokensApprox(errText),
            userId: getSignedInUserId(),
            thinking: null,
          });
          if (rid?.response_id != null)
            savedIdsRef.current.set(keyOf(currentQuestion || message, errText), rid.response_id);
        } catch (e) {
          console.warn('Failed to save error response:', e);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return {
    chatHistory,
    currentQuestion,
    isLoading,
    handleSend,
    setChatHistory,
    stopGeneration,
  };
};

export { resolveResponseId, keyOf };