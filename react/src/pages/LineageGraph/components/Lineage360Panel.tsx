import React, { useEffect, useState, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  TextField,
  Avatar,
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import AddIcon from '@mui/icons-material/Add';
import HistoryIcon from '@mui/icons-material/History';
import EditNoteOutlinedIcon from '@mui/icons-material/EditNoteOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import CheckIcon from '@mui/icons-material/Check';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import api from '../../../api';
import type { LineageNodeData } from '../LineageNode';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface Lineage360PanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string | null;
  nodeData: LineageNodeData | null;
}

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  nodeId: string | null;
  timestamp: number;
}

const STORAGE_KEY = 'lineage360_chat_history';

function loadHistory(): ChatSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(sessions: ChatSession[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.slice(0, 20)));
}

const Lineage360Panel: React.FC<Lineage360PanelProps> = ({
  isOpen,
  onClose,
  nodeId,
  nodeData,
}) => {
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [userName, setUserName] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>(loadHistory);
  const [currentSessionId, setCurrentSessionId] = useState<string>(Date.now().toString());
  const [nodeCleared, setNodeCleared] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    api.get('/snowflake/current-user')
      .then((res) => {
        const data = res.data?.data;
        const name = data?.USERNAME || data?.userName || data?.loginName || data?.LOGIN_NAME || data?.CURRENT_USER || '';
        setUserName(name);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setChatMessages([]);
    setChatInput('');
    setCurrentSessionId(Date.now().toString());
    setShowHistory(false);
    setNodeCleared(false);
  }, [nodeId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  useEffect(() => {
    if (chatMessages.length > 0) {
      const title = chatMessages[0]?.content?.slice(0, 40) || 'New chat';
      setChatHistory((prev) => {
        const existing = prev.filter((s) => s.id !== currentSessionId);
        const updated = [{ id: currentSessionId, title, messages: chatMessages, nodeId, timestamp: Date.now() }, ...existing];
        saveHistory(updated);
        return updated;
      });
    }
  }, [chatMessages, currentSessionId, nodeId]);

  const handleNewChat = () => {
    setChatMessages([]);
    setChatInput('');
    setCurrentSessionId(Date.now().toString());
    setShowHistory(false);
    setNodeCleared(true);
  };

  const handleLoadSession = (session: ChatSession) => {
    setChatMessages(session.messages);
    setCurrentSessionId(session.id);
    setShowHistory(false);
  };

  const handleDeleteSession = (id: string) => {
    setChatHistory((prev) => {
      const updated = prev.filter((s) => s.id !== id);
      saveHistory(updated);
      return updated;
    });
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await api.post('/api/lineage-ai/chat', {
        question: userMessage,
        nodeId,
        nodeType: nodeData?.nodeType || 'unknown',
        nodeLabel: nodeData?.label || '',
        graphContext: {
          fullId: nodeData?.fullId || nodeId,
          subtitle: nodeData?.subtitle || '',
        },
      }, { signal: controller.signal });
      const answer = res.data?.response || res.data?.data?.response || 'No response received.';
      setChatMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
    } catch (err: any) {
      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', content: '_Response generation stopped._' },
        ]);
      } else {
        setChatMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `Error: ${err?.message || 'Failed to get AI response'}` },
        ]);
      }
    } finally {
      abortControllerRef.current = null;
      setChatLoading(false);
    }
  };

  const handleStopChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  if (!isOpen) return null;

  const parts = nodeId?.split('.') || [];
  const objectName = nodeCleared ? '' : (parts[parts.length - 1] || nodeData?.label || '');

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 480,
        minWidth: 360,
        maxWidth: '65vw',
        bgcolor: '#ffffff',
        borderLeft: '1px solid #e5e7eb',
        boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.06)',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInRight 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        overflow: 'hidden',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2.5,
          py: 1.5,
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
          <AutoAwesomeOutlinedIcon sx={{ fontSize: 18, color: '#2563eb' }} />
          <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>
            Lineage360
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="New chat">
            <IconButton
              size="small"
              onClick={handleNewChat}
              sx={{ width: 28, height: 28, color: '#64748b', '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a' } }}
            >
              <EditNoteOutlinedIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Chat history">
            <IconButton
              size="small"
              onClick={() => setShowHistory(!showHistory)}
              sx={{ width: 28, height: 28, color: showHistory ? '#2563eb' : '#64748b', '&:hover': { bgcolor: '#f1f5f9', color: '#0f172a' } }}
            >
              <HistoryIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ width: 28, height: 28, color: '#94a3b8', '&:hover': { bgcolor: '#f1f5f9', color: '#475569' } }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      </Box>

      {showHistory ? (
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2.5, py: 1.5, borderBottom: '1px solid #f1f5f9' }}>
            <IconButton size="small" onClick={() => setShowHistory(false)} sx={{ width: 24, height: 24, color: '#64748b' }}>
              <ArrowBackIcon sx={{ fontSize: 14 }} />
            </IconButton>
            <Typography sx={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>
              Chat History
            </Typography>
          </Box>
          <Box sx={{ flex: 1, overflowY: 'auto', px: 2, py: 1, '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 3 } }}>
            {chatHistory.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <HistoryIcon sx={{ fontSize: 28, color: '#e2e8f0', mb: 1 }} />
                <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>No chat history yet</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                {chatHistory.map((session) => (
                  <Box
                    key={session.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      px: 1.5,
                      py: 1,
                      borderRadius: 1.5,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      bgcolor: session.id === currentSessionId ? '#eff6ff' : 'transparent',
                      '&:hover': { bgcolor: '#f8fafc' },
                    }}
                  >
                    <Box
                      onClick={() => handleLoadSession(session)}
                      sx={{ flex: 1, minWidth: 0 }}
                    >
                      <Typography sx={{ fontSize: '0.75rem', fontWeight: 500, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {session.title}
                      </Typography>
                      <Typography sx={{ fontSize: '0.65rem', color: '#94a3b8' }}>
                        {new Date(session.timestamp).toLocaleDateString()} · {session.messages.length} msgs
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.id); }}
                      sx={{ width: 22, height: 22, color: '#cbd5e1', '&:hover': { color: '#ef4444' } }}
                    >
                      <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      ) : (
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box
          sx={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            '&::-webkit-scrollbar': { width: 6 },
            '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 3 },
          }}
        >
          {chatMessages.length === 0 ? (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', px: 2.5 }}>
              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-start', py: 4 }}>
                <Typography
                  sx={{
                    fontSize: '1.5rem',
                    fontWeight: 300,
                    color: '#1e293b',
                    lineHeight: 1.3,
                    mb: 0.5,
                  }}
                >
                  Hi{userName ? ` ${userName.charAt(0).toUpperCase() + userName.slice(1).toLowerCase()}` : ''},
                </Typography>
                <Typography
                  sx={{
                    fontSize: '1.5rem',
                    fontWeight: 300,
                    color: '#2563eb',
                    lineHeight: 1.3,
                    mb: 3,
                  }}
                >
                  How can I help?
                </Typography>

                <Box
                  onClick={() => {
                    const msg = 'Show me what Lineage360 can do';
                    setChatInput('');
                    setChatMessages((prev) => [...prev, { role: 'user', content: msg }]);
                    setChatLoading(true);
                    const controller = new AbortController();
                    abortControllerRef.current = controller;
                    api.post('/api/lineage-ai/chat', {
                      question: msg,
                      nodeId,
                      nodeType: nodeData?.nodeType || 'unknown',
                      nodeLabel: nodeData?.label || '',
                      graphContext: {
                        fullId: nodeData?.fullId || nodeId,
                        subtitle: nodeData?.subtitle || '',
                      },
                    }, { signal: controller.signal }).then((res) => {
                      const answer = res.data?.response || res.data?.data?.response || 'No response received.';
                      setChatMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
                    }).catch((err: any) => {
                      if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
                        setChatMessages((prev) => [...prev, { role: 'assistant', content: '_Response generation stopped._' }]);
                      } else {
                        setChatMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err?.message || 'Failed to get AI response'}` }]);
                      }
                    }).finally(() => { abortControllerRef.current = null; setChatLoading(false); });
                  }}
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 2,
                    py: 1,
                    borderRadius: 5,
                    border: '1px solid #e2e8f0',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    '&:hover': { borderColor: '#2563eb' },
                  }}
                >
                  <Typography sx={{ fontSize: '0.75rem', color: '#475569', fontWeight: 500 }}>
                    Show me what Lineage360 can do
                  </Typography>
                </Box>

                <Box sx={{ mt: 4, width: '100%' }}>
                  <Typography sx={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 500, mb: 1.5 }}>
                    Suggested questions
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {[
                      'What feeds this table?',
                      'Show upstream dependencies',
                      'Explain this node\'s purpose',
                      'What is the impact of changing this?',
                      'Does this table have PII? What\'s the compliance status?',
                    ].map((suggestion) => (
                      <Box
                        key={suggestion}
                        onClick={() => {
                          setChatInput(suggestion);
                          setTimeout(() => {
                            const msg = suggestion.trim();
                            setChatInput('');
                            setChatMessages((prev) => [...prev, { role: 'user', content: msg }]);
                            setChatLoading(true);
                            const controller = new AbortController();
                            abortControllerRef.current = controller;
                            api.post('/api/lineage-ai/chat', {
                              question: msg,
                              nodeId,
                              nodeType: nodeData?.nodeType || 'unknown',
                              nodeLabel: nodeData?.label || '',
                              graphContext: {
                                fullId: nodeData?.fullId || nodeId,
                                subtitle: nodeData?.subtitle || '',
                              },
                            }, { signal: controller.signal }).then((res) => {
                              const answer = res.data?.response || res.data?.data?.response || 'No response received.';
                              setChatMessages((prev) => [...prev, { role: 'assistant', content: answer }]);
                            }).catch((err: any) => {
                              if (err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError') {
                                setChatMessages((prev) => [...prev, { role: 'assistant', content: '_Response generation stopped._' }]);
                              } else {
                                setChatMessages((prev) => [...prev, { role: 'assistant', content: `Error: ${err?.message || 'Failed to get AI response'}` }]);
                              }
                            }).finally(() => { abortControllerRef.current = null; setChatLoading(false); });
                          }, 0);
                        }}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          px: 1.5,
                          py: 1,
                          borderRadius: 1.5,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                          '&:hover': { bgcolor: '#f8fafc' },
                        }}
                      >
                        <ChatBubbleOutlineIcon sx={{ fontSize: 14, color: '#94a3b8' }} />
                        <Typography
                          sx={{
                            fontSize: '0.75rem',
                            color: '#475569',
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {suggestion}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>
            </Box>
          ) : (
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, px: 2.5, py: 2 }}>
              {chatMessages.map((msg, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex',
                    gap: 1.5,
                    alignItems: 'flex-start',
                    flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  }}
                >
                  <Avatar
                    sx={{
                      width: 24,
                      height: 24,
                      flexShrink: 0,
                      bgcolor: 'transparent',
                    }}
                  >
                    {msg.role === 'user' ? (
                      <PersonOutlinedIcon sx={{ fontSize: 16, color: '#64748b' }} />
                    ) : (
                      <AutoAwesomeOutlinedIcon sx={{ fontSize: 16, color: '#2563eb' }} />
                    )}
                  </Avatar>
                  <Box
                    sx={{
                      maxWidth: '85%',
                      px: 1.75,
                      py: 1.25,
                      borderRadius: 2.5,
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    {msg.role === 'assistant' ? (
                      <>
                      <Box
                        sx={{
                          fontSize: '0.775rem',
                          lineHeight: 1.7,
                          color: '#1e293b',
                          wordBreak: 'break-word',
                          '& p': { m: 0, mb: 0.75, '&:last-child': { mb: 0 } },
                          '& ul, & ol': { m: 0, pl: 2, mb: 0.75 },
                          '& li': { mb: 0.25 },
                          '& code': {
                            fontSize: '0.7rem',
                            px: 0.5,
                            py: 0.125,
                            borderRadius: 0.5,
                            bgcolor: '#f1f5f9',
                            fontFamily: '"SF Mono", "Fira Code", monospace',
                          },
                          '& pre': {
                            m: 0,
                            mb: 0.75,
                            p: 1,
                            borderRadius: 1,
                            bgcolor: '#f8fafc',
                            overflow: 'auto',
                            '& code': { bgcolor: 'transparent', p: 0 },
                          },
                          '& strong': { fontWeight: 700 },
                          '& h1, & h2, & h3, & h4': { fontSize: '0.8rem', fontWeight: 700, mt: 1, mb: 0.5 },
                          '& table': { borderCollapse: 'collapse', width: '100%', mb: 0.75, fontSize: '0.7rem' },
                          '& th, & td': { border: '1px solid #e5e7eb', px: 1, py: 0.5, textAlign: 'left' },
                          '& th': { fontWeight: 600, bgcolor: '#f8fafc' },
                          '& blockquote': { m: 0, pl: 1.5, borderLeft: '3px solid #e2e8f0', color: '#64748b' },
                        }}
                      >
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                      </Box>
                      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            navigator.clipboard.writeText(msg.content);
                            const btn = document.getElementById(`copy-btn-${idx}`);
                            if (btn) { btn.setAttribute('data-copied', 'true'); setTimeout(() => btn.removeAttribute('data-copied'), 2000); }
                          }}
                          id={`copy-btn-${idx}`}
                          sx={{ width: 22, height: 22, color: '#94a3b8', '&:hover': { color: '#475569', bgcolor: '#f1f5f9' }, '&[data-copied=true]': { color: '#16a34a' } }}
                          title="Copy response"
                        >
                          <ContentCopyIcon sx={{ fontSize: 12 }} />
                        </IconButton>
                      </Box>
                      </>
                    ) : (
                      <Typography
                        sx={{
                          fontSize: '0.775rem',
                          lineHeight: 1.7,
                          color: '#1e293b',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {msg.content}
                      </Typography>
                    )}
                  </Box>
                </Box>
              ))}

              {chatLoading && (
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <Avatar sx={{ width: 24, height: 24, bgcolor: 'transparent' }}>
                    <AutoAwesomeOutlinedIcon sx={{ fontSize: 16, color: '#2563eb' }} />
                  </Avatar>
                  <Box
                    sx={{
                      px: 1.75,
                      py: 1.25,
                      borderRadius: 2.5,
                      border: '1px solid #e5e7eb',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      {[0, 1, 2].map((i) => (
                        <Box
                          key={i}
                          sx={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            bgcolor: '#94a3b8',
                            animation: 'pulse 1.4s infinite ease-in-out',
                            animationDelay: `${i * 0.2}s`,
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                </Box>
              )}
              <div ref={chatEndRef} />
            </Box>
          )}
        </Box>

        <Box sx={{ px: 2, pb: 2, pt: 1 }}>
          <Box
            sx={{
              border: '1px solid #e5e7eb',
              borderRadius: 2.5,
              overflow: 'hidden',
              transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
              '&:focus-within': {
                borderColor: '#2563eb',
                boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)',
              },
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', px: 1.25, pt: 0.5 }}>
              {objectName && (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    px: 0.75,
                    py: 0.25,
                    borderRadius: 1,
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <Typography sx={{ fontSize: '0.62rem', fontWeight: 600, color: '#2563eb' }}>
                    @{objectName}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={() => setNodeCleared(true)}
                    sx={{ width: 14, height: 14, p: 0, color: '#94a3b8', '&:hover': { color: '#ef4444' } }}
                  >
                    <CloseIcon sx={{ fontSize: 10 }} />
                  </IconButton>
                </Box>
              )}
            </Box>
            <TextField
              fullWidth
              size="medium"
              placeholder="Ask about this node..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendChat();
                }
              }}
              sx={{
                '& .MuiOutlinedInput-root': {
                  fontSize: '1rem',
                  border: 'none',
                  minHeight: 'unset',
                  '& fieldset': { border: 'none' },
                },
                '& .MuiInputBase-input': {
                  py: 1.25,
                  px: 1.5,
                  '&::placeholder': { color: '#94a3b8', opacity: 1 },
                },
              }}
            />
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1.25,
                pb: 0.5,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton size="small" sx={{ width: 22, height: 22, color: '#94a3b8' }}>
                  <AddIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Box>
              {chatLoading ? (
                <IconButton
                  size="small"
                  onClick={handleStopChat}
                  sx={{
                    width: 26,
                    height: 26,
                    bgcolor: '#ef4444',
                    color: '#ffffff',
                    borderRadius: '50%',
                    '&:hover': { bgcolor: '#dc2626' },
                  }}
                  title="Stop generating"
                >
                  <StopCircleIcon sx={{ fontSize: 16 }} />
                </IconButton>
              ) : (
                <IconButton
                  size="small"
                  onClick={handleSendChat}
                  disabled={!chatInput.trim()}
                  sx={{
                    width: 26,
                    height: 26,
                    bgcolor: chatInput.trim() ? '#2563eb' : 'transparent',
                    color: chatInput.trim() ? '#ffffff' : '#cbd5e1',
                    borderRadius: '50%',
                    '&:hover': { bgcolor: chatInput.trim() ? '#1d4ed8' : 'transparent' },
                    '&.Mui-disabled': { bgcolor: 'transparent', color: '#e2e8f0' },
                  }}
                >
                  <SendIcon sx={{ fontSize: 16 }} />
                </IconButton>
              )}
            </Box>
          </Box>
        </Box>
      </Box>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes pulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </Box>
  );
};

export default Lineage360Panel;
