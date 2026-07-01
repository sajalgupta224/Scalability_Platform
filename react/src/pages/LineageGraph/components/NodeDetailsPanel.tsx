import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Chip,
  Divider,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import api from '../../../api';
import type { LineageNodeData } from '../LineageNode';

interface NodeDetailsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodeId: string | null;
  nodeData: LineageNodeData | null;
}

const NODE_TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; label: string }> = {
  table: {
    icon: <StorageOutlinedIcon sx={{ fontSize: 14 }} />,
    color: '#16a34a',
    bg: '#f0fdf4',
    label: 'TABLE',
  },
  view: {
    icon: <GridViewOutlinedIcon sx={{ fontSize: 14 }} />,
    color: '#7c3aed',
    bg: '#f5f3ff',
    label: 'VIEW',
  },
  column: {
    icon: <ViewColumnOutlinedIcon sx={{ fontSize: 14 }} />,
    color: '#d97706',
    bg: '#fffbeb',
    label: 'COLUMN',
  },
  root: {
    icon: <AccountTreeOutlinedIcon sx={{ fontSize: 14 }} />,
    color: '#2563eb',
    bg: '#eff6ff',
    label: 'ROOT',
  },
  default: {
    icon: <StorageOutlinedIcon sx={{ fontSize: 14 }} />,
    color: '#64748b',
    bg: '#f8fafc',
    label: 'OBJECT',
  },
};

const NodeDetailsPanel: React.FC<NodeDetailsPanelProps> = ({
  isOpen,
  onClose,
  nodeId,
  nodeData,
}) => {
  const [columns, setColumns] = useState<Array<{ name: string; type: string }>>([]);
  const [columnsLoading, setColumnsLoading] = useState(false);
  const [columnsError, setColumnsError] = useState<string | null>(null);
  const [piiColumns, setPiiColumns] = useState<Array<{ COLUMN_NAME: string; PII_TYPE: string; CONFIDENCE: number; STATUS: string; IS_MASKED: boolean }>>([]);
  const [piiLoading, setPiiLoading] = useState(false);

  useEffect(() => {
    if (!nodeId || !isOpen) return;

    const parts = nodeId.split('.');
    if (parts.length < 3) {
      setColumns([]);
      setColumnsError('Invalid node ID format');
      return;
    }

    const [db, schema, table] = parts;
    setColumnsLoading(true);
    setColumnsError(null);

    api
      .get('/api/columns', { params: { db, schema, table } })
      .then((res) => {
        const data = res.data;
        const normalized = Array.isArray(data)
          ? data.map((item: any) =>
              typeof item === 'string'
                ? { name: item, type: '' }
                : { name: item?.name ?? '', type: item?.type ?? '' }
            ).filter((c) => c.name)
          : [];
        setColumns(normalized);
      })
      .catch((err) => {
        setColumnsError(err?.message || 'Failed to fetch columns');
        setColumns([]);
      })
      .finally(() => setColumnsLoading(false));

    // Fetch PII data
    setPiiLoading(true);
    const BASE = import.meta.env.VITE_API_BASE_URL || '';
    fetch(`${BASE}/api/pii/by-object?database=${db}&schema=${schema}&table=${table}`)
      .then((res) => res.ok ? res.json() : { columns: [] })
      .then((data) => setPiiColumns(data.columns || []))
      .catch(() => setPiiColumns([]))
      .finally(() => setPiiLoading(false));
  }, [nodeId, isOpen]);

  if (!isOpen) return null;

  const typeConfig = NODE_TYPE_CONFIG[nodeData?.nodeType || 'default'] || NODE_TYPE_CONFIG.default;
  const parts = nodeId?.split('.') || [];
  const objectName = parts[parts.length - 1] || nodeData?.label || 'Unknown';
  const schemaPath = parts.length >= 3 ? `${parts[0]}.${parts[1]}` : '';

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: 420,
        bgcolor: '#ffffff',
        borderLeft: '1px solid #e5e7eb',
        boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.06)',
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        animation: 'slideInRight 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 2,
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                bgcolor: typeConfig.bg,
                border: `1.5px solid ${typeConfig.color}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: typeConfig.color,
              }}
            >
              {typeConfig.icon}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                sx={{
                  fontWeight: 700,
                  fontSize: '0.875rem',
                  color: '#0f172a',
                  lineHeight: 1.3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {objectName}
              </Typography>
              {schemaPath && (
                <Typography
                  sx={{
                    fontSize: '0.7rem',
                    color: '#94a3b8',
                    mt: 0.25,
                    fontFamily: '"SF Mono", "Fira Code", monospace',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {schemaPath}
                </Typography>
              )}
            </Box>
          </Box>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{
              width: 28,
              height: 28,
              color: '#94a3b8',
              '&:hover': { bgcolor: '#f1f5f9', color: '#475569' },
            }}
          >
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.75, mt: 1.5, flexWrap: 'wrap' }}>
          <Chip
            icon={typeConfig.icon as React.ReactElement}
            label={typeConfig.label}
            size="small"
            sx={{
              height: 22,
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.5px',
              bgcolor: typeConfig.bg,
              color: typeConfig.color,
              border: `1px solid ${typeConfig.color}30`,
              '& .MuiChip-icon': { color: typeConfig.color, fontSize: 12 },
            }}
          />
          {nodeData?.freshnessStatus && nodeData.freshnessStatus !== 'unknown' && (
            <Chip
              size="small"
              label={nodeData.freshnessStatus === 'fresh' ? 'Fresh' : nodeData.freshnessStatus === 'stale' ? 'Stale' : 'Old'}
              sx={{
                height: 22,
                fontSize: '0.65rem',
                fontWeight: 600,
                bgcolor: nodeData.freshnessStatus === 'fresh' ? '#f0fdf4' : nodeData.freshnessStatus === 'stale' ? '#fffbeb' : '#fef2f2',
                color: nodeData.freshnessStatus === 'fresh' ? '#16a34a' : nodeData.freshnessStatus === 'stale' ? '#d97706' : '#dc2626',
                border: `1px solid ${nodeData.freshnessStatus === 'fresh' ? '#16a34a' : nodeData.freshnessStatus === 'stale' ? '#d97706' : '#dc2626'}30`,
              }}
            />
          )}
        </Box>
      </Box>

      <Box sx={{ flex: 1, overflowY: 'auto', '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-thumb': { bgcolor: '#e2e8f0', borderRadius: 3 } }}>
        <Box sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
          <Typography
            sx={{
              fontSize: '0.7rem',
              fontWeight: 700,
              color: '#64748b',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              mb: 0.5,
            }}
          >
            Object Info
          </Typography>
        </Box>

        <Box sx={{ px: 2.5, pb: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {[
              { label: 'Database', value: parts[0] || '—' },
              { label: 'Schema', value: parts[1] || '—' },
              { label: 'Name', value: parts[2] || nodeData?.label || '—' },
              ...(nodeData?.lastAltered ? [{ label: 'Last Altered', value: new Date(nodeData.lastAltered).toLocaleString() }] : []),
            ].map((item) => (
              <Box
                key={item.label}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  py: 0.75,
                }}
              >
                <Typography sx={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>
                  {item.label}
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.75rem',
                    color: '#0f172a',
                    fontWeight: 600,
                    fontFamily: '"SF Mono", "Fira Code", monospace',
                    maxWidth: '60%',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    textAlign: 'right',
                  }}
                >
                  {item.value}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Divider sx={{ borderColor: '#f1f5f9' }} />

        <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography
              sx={{
                fontSize: '0.7rem',
                fontWeight: 700,
                color: '#64748b',
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
              }}
            >
              Columns
            </Typography>
            {!columnsLoading && !columnsError && columns.length > 0 && (
              <Chip
                label={columns.length}
                size="small"
                sx={{
                  height: 18,
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  bgcolor: '#f1f5f9',
                  color: '#475569',
                  '& .MuiChip-label': { px: 1 },
                }}
              />
            )}
          </Box>
        </Box>

        <Box sx={{ px: 2.5, pb: 2 }}>
          {columnsLoading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 3, justifyContent: 'center' }}>
              <CircularProgress size={18} thickness={5} sx={{ color: '#94a3b8' }} />
              <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Loading columns...
              </Typography>
            </Box>
          )}

          {columnsError && (
            <Box
              sx={{
                py: 2,
                px: 1.5,
                borderRadius: 1.5,
                bgcolor: '#fef2f2',
                border: '1px solid #fee2e2',
              }}
            >
              <Typography sx={{ fontSize: '0.75rem', color: '#dc2626' }}>
                {columnsError}
              </Typography>
            </Box>
          )}

          {!columnsLoading && !columnsError && columns.length === 0 && (
            <Box sx={{ py: 3, textAlign: 'center' }}>
              <ViewColumnOutlinedIcon sx={{ fontSize: 28, color: '#e2e8f0', mb: 0.5 }} />
              <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                No columns found
              </Typography>
            </Box>
          )}

          {!columnsLoading && columns.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              {columns.map((col, idx) => (
                <Box
                  key={idx}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.5,
                    py: 0.875,
                    borderRadius: 1.5,
                    transition: 'background 0.15s ease',
                    '&:hover': { bgcolor: '#f8fafc' },
                  }}
                >
                  <Box
                    sx={{
                      width: 4,
                      height: 4,
                      borderRadius: '50%',
                      bgcolor: '#cbd5e1',
                      flexShrink: 0,
                    }}
                  />
                  <Typography
                    sx={{
                      fontSize: '0.775rem',
                      fontWeight: 500,
                      color: '#1e293b',
                      fontFamily: '"SF Mono", "Fira Code", monospace',
                      letterSpacing: '-0.2px',
                      flex: 1,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {col.name}
                  </Typography>
                  {col.type && (
                    <Typography
                      sx={{
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        color: '#64748b',
                        bgcolor: '#f1f5f9',
                        px: 0.875,
                        py: 0.25,
                        borderRadius: 1,
                        fontFamily: '"SF Mono", "Fira Code", monospace',
                        letterSpacing: '-0.1px',
                        flexShrink: 0,
                      }}
                    >
                      {col.type}
                    </Typography>
                  )}
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* PII Section */}
        {(piiLoading || piiColumns.length > 0) && (
          <>
            <Divider sx={{ borderColor: '#f1f5f9' }} />
            <Box sx={{ px: 2.5, pt: 2, pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <ShieldOutlinedIcon sx={{ fontSize: 14, color: '#7c3aed' }} />
                  <Typography
                    sx={{
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      color: '#64748b',
                      textTransform: 'uppercase',
                      letterSpacing: '0.8px',
                    }}
                  >
                    PII Detected
                  </Typography>
                </Box>
                {piiColumns.length > 0 && (
                  <Chip
                    label={piiColumns.length}
                    size="small"
                    sx={{
                      height: 18,
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      bgcolor: '#fef2f2',
                      color: '#dc2626',
                      '& .MuiChip-label': { px: 1 },
                    }}
                  />
                )}
              </Box>
            </Box>
            <Box sx={{ px: 2.5, pb: 2 }}>
              {piiLoading ? (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 2, justifyContent: 'center' }}>
                  <CircularProgress size={16} thickness={5} sx={{ color: '#7c3aed' }} />
                  <Typography sx={{ fontSize: '0.75rem', color: '#94a3b8' }}>Checking PII...</Typography>
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {piiColumns.map((pii, idx) => (
                    <Box
                      key={idx}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        px: 1.5,
                        py: 0.75,
                        borderRadius: 1.5,
                        bgcolor: pii.STATUS === 'MASKED' ? '#f0fdf4' : '#fef2f2',
                        border: `1px solid ${pii.STATUS === 'MASKED' ? '#bbf7d0' : '#fecaca'}`,
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: '0.725rem',
                          fontWeight: 600,
                          color: '#1e293b',
                          fontFamily: '"SF Mono", "Fira Code", monospace',
                          flex: 1,
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {pii.COLUMN_NAME}
                      </Typography>
                      <Chip
                        label={pii.PII_TYPE}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: '0.6rem',
                          fontWeight: 700,
                          bgcolor: pii.STATUS === 'MASKED' ? '#dcfce7' : '#fee2e2',
                          color: pii.STATUS === 'MASKED' ? '#16a34a' : '#dc2626',
                        }}
                      />
                      <Chip
                        label={pii.STATUS === 'MASKED' ? 'Protected' : 'Exposed'}
                        size="small"
                        sx={{
                          height: 16,
                          fontSize: '0.55rem',
                          fontWeight: 600,
                          bgcolor: pii.STATUS === 'MASKED' ? '#16a34a' : '#dc2626',
                          color: '#fff',
                        }}
                      />
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </>
        )}
      </Box>

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </Box>
  );
};

export default NodeDetailsPanel;
