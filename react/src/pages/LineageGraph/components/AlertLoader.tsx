import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Button,
  TextField,
  Tooltip,
  Collapse,
  Badge,
  ToggleButtonGroup,
  ToggleButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from "@mui/material";
import ErrorIcon from "@mui/icons-material/Error";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import RefreshIcon from "@mui/icons-material/Refresh";
import NotificationsActiveIcon from "@mui/icons-material/NotificationsActive";
import VisibilityIcon from "@mui/icons-material/Visibility";
import api from "../../../api";

// =============================================================================
// Types
// =============================================================================
interface Alert {
  ALERT_ID: string;
  ANALYSIS_ID: string;
  TIMESTAMP: string;
  SEVERITY: "HIGH" | "MODERATE" | "WARNING";
  ACTION_TYPE: string;
  SOURCE_NODE: string;
  AFFECTED_NODE: string;
  AFFECTED_NODE_TYPE: string;
  IMPACT_DISTANCE: number;
  IMPACT_DESCRIPTION: string;
  WILL_BREAK: boolean;
  RISK_SCORE: number;
  ACKNOWLEDGED: boolean;
  ACKNOWLEDGED_BY: string | null;
  ACKNOWLEDGED_AT: string | null;
  RESOLUTION_NOTE: string | null;
  STATUS?: "PLANNED" | "EXECUTED";
  EXECUTED_BY?: string | null;
  EXECUTED_AT?: string | null;
  CREATED_BY?: string | null;
}

interface AlertSummary {
  HIGH_UNACK: number;
  MODERATE_UNACK: number;
  WARNING_UNACK: number;
}

type SeverityFilter = "ALL" | "HIGH" | "MODERATE" | "WARNING";

// =============================================================================
// Constants
// =============================================================================
const SEVERITY_CONFIG = {
  HIGH: { color: "#dc2626", bg: "#fef2f2", borderColor: "#fecaca", icon: <ErrorIcon fontSize="small" />, label: "High" },
  MODERATE: { color: "#ea580c", bg: "#fff7ed", borderColor: "#fed7aa", icon: <WarningAmberIcon fontSize="small" />, label: "Moderate" },
  WARNING: { color: "#ca8a04", bg: "#fefce8", borderColor: "#fef08a", icon: <InfoOutlinedIcon fontSize="small" />, label: "Warning" },
};

const ACTION_LABELS: Record<string, string> = {
  NODE_DELETE: "Delete Object",
  COLUMN_DELETE: "Drop Column",
  COLUMN_RENAME: "Rename Column",
  TYPE_CHANGE: "Type Change",
  DEPENDENCY_CHANGE: "Dependency Change",
  SOURCE_DISCONNECT: "Source Disconnected",
  SCHEMA_MOVE: "Schema Move",
  NODE_ADD: "New Object",
  COLUMN_ADD: "New Column",
};

// =============================================================================
// Component
// =============================================================================
interface Props {
  onAlertCountChange?: (count: number) => void;
  onViewInGraph?: (nodeId: string) => void;
}

const AlertLoader: React.FC<Props> = ({ onAlertCountChange, onViewInGraph }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertSummary>({ HIGH_UNACK: 0, MODERATE_UNACK: 0, WARNING_UNACK: 0 });
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<SeverityFilter>("ALL");
  const [showAcknowledged, setShowAcknowledged] = useState(false);
  const [ackDialogOpen, setAckDialogOpen] = useState(false);
  const [ackAlertId, setAckAlertId] = useState<string | null>(null);
  const [ackNote, setAckNote] = useState("");
  const [expanded, setExpanded] = useState(true);
  const [newAlertCount, setNewAlertCount] = useState(0);
  const [lastPollTime, setLastPollTime] = useState<string>(new Date().toISOString());

  // ---------------------------------------------------------------------------
  // Auto-polling every 30 seconds
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      fetchAlerts();
    }, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch alerts
  // ---------------------------------------------------------------------------
  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: "100" };
      if (filter !== "ALL") params.severity = filter;
      if (!showAcknowledged) params.acknowledged = "false";

      const resp = await api.get("/api/impact/alerts", { params });
      const newAlerts = resp.data.alerts || [];
      // Detect new alerts since last poll
      const prevCount = alerts.length;
      if (newAlerts.length > prevCount && prevCount > 0) {
        setNewAlertCount(newAlerts.length - prevCount);
        setTimeout(() => setNewAlertCount(0), 5000); // Clear badge after 5s
      }
      setAlerts(newAlerts);
      setSummary(resp.data.summary || { HIGH_UNACK: 0, MODERATE_UNACK: 0, WARNING_UNACK: 0 });
      setLastPollTime(new Date().toISOString());

      // Notify parent of unacknowledged count
      const totalUnack = (resp.data.summary?.HIGH_UNACK || 0) + (resp.data.summary?.MODERATE_UNACK || 0) + (resp.data.summary?.WARNING_UNACK || 0);
      onAlertCountChange?.(totalUnack);
    } catch (err) {
      console.error("Failed to fetch alerts:", err);
    } finally {
      setLoading(false);
    }
  }, [filter, showAcknowledged, onAlertCountChange]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // ---------------------------------------------------------------------------
  // Acknowledge
  // ---------------------------------------------------------------------------
  const handleAcknowledge = async () => {
    if (!ackAlertId) return;
    try {
      await api.put(`/api/impact/alerts/${ackAlertId}/ack`, { resolutionNote: ackNote });
      setAckDialogOpen(false);
      setAckAlertId(null);
      setAckNote("");
      fetchAlerts();
    } catch (err) {
      console.error("Failed to acknowledge:", err);
    }
  };

  // ---------------------------------------------------------------------------
  // Dismiss
  // ---------------------------------------------------------------------------
  const handleDismiss = async (alertId: string) => {
    try {
      await api.delete(`/api/impact/alerts/${alertId}`);
      fetchAlerts();
    } catch (err) {
      console.error("Failed to dismiss:", err);
    }
  };

  // ---------------------------------------------------------------------------
  // Confirm Change Executed
  // ---------------------------------------------------------------------------
  const handleConfirmChange = async (alertId: string) => {
    try {
      await api.put(`/api/impact/alerts/${alertId}/confirm`, { executedBy: "current_user" });
      fetchAlerts();
    } catch (err) {
      console.error("Failed to confirm change:", err);
    }
  };

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------
  const formatTime = (ts: string) => {
    if (!ts) return "";
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "Just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    return `${diffDays}d ago`;
  };

  const getNodeShortName = (fqn: string) => fqn.split(".").pop() || fqn;

  const totalUnack = summary.HIGH_UNACK + summary.MODERATE_UNACK + summary.WARNING_UNACK;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Box sx={{ border: "1px solid #e2e8f0", borderRadius: 2, overflow: "hidden" }}>
      {/* Header */}
      <Box
        onClick={() => setExpanded(!expanded)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 1.5,
          bgcolor: totalUnack > 0 ? "#fef2f2" : "#f8fafc",
          cursor: "pointer",
          "&:hover": { bgcolor: totalUnack > 0 ? "#fee2e2" : "#f1f5f9" },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Badge badgeContent={totalUnack} color="error" max={99}>
            <NotificationsActiveIcon sx={{ color: totalUnack > 0 ? "#dc2626" : "#64748b" }} />
          </Badge>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "#1e293b" }}>
            Alert Loader
          </Typography>
          {totalUnack > 0 && (
            <Chip
              size="small"
              label={`${totalUnack} unacknowledged`}
              sx={{ bgcolor: "#dc2626", color: "#fff", fontSize: 10, height: 20 }}
            />
          )}
          {newAlertCount > 0 && (
            <Chip
              size="small"
              label={`${newAlertCount} new!`}
              sx={{ bgcolor: "#7c3aed", color: "#fff", fontSize: 10, height: 20, animation: "pulse 1s infinite" }}
            />
          )}
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Tooltip title="Refresh">
            <IconButton
              size="small"
              onClick={(e) => { e.stopPropagation(); fetchAlerts(); }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </Box>
      </Box>

      <Collapse in={expanded}>
        {/* Filters */}
        <Box sx={{ p: 1.5, borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
          <ToggleButtonGroup
            value={filter}
            exclusive
            onChange={(_, val) => val && setFilter(val as SeverityFilter)}
            size="small"
          >
            <ToggleButton value="ALL" sx={{ textTransform: "none", fontSize: 11, px: 1.5 }}>
              All
            </ToggleButton>
            <ToggleButton value="HIGH" sx={{ textTransform: "none", fontSize: 11, px: 1.5, color: "#dc2626" }}>
              <ErrorIcon sx={{ fontSize: 14, mr: 0.5 }} /> High ({summary.HIGH_UNACK})
            </ToggleButton>
            <ToggleButton value="MODERATE" sx={{ textTransform: "none", fontSize: 11, px: 1.5, color: "#ea580c" }}>
              <WarningAmberIcon sx={{ fontSize: 14, mr: 0.5 }} /> Moderate ({summary.MODERATE_UNACK})
            </ToggleButton>
            <ToggleButton value="WARNING" sx={{ textTransform: "none", fontSize: 11, px: 1.5, color: "#ca8a04" }}>
              <InfoOutlinedIcon sx={{ fontSize: 14, mr: 0.5 }} /> Warning ({summary.WARNING_UNACK})
            </ToggleButton>
          </ToggleButtonGroup>

          <Chip
            size="small"
            label={showAcknowledged ? "Hide Acknowledged" : "Show Acknowledged"}
            variant="outlined"
            onClick={() => setShowAcknowledged(!showAcknowledged)}
            sx={{ fontSize: 10 }}
          />
        </Box>

        {/* Alert List */}
        <Box sx={{ maxHeight: 400, overflowY: "auto", p: 1 }}>
          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
              <CircularProgress size={24} />
            </Box>
          )}

          {!loading && alerts.length === 0 && (
            <Box sx={{ textAlign: "center", p: 3, color: "#94a3b8" }}>
              <CheckCircleIcon sx={{ fontSize: 40, mb: 1, color: "#22c55e" }} />
              <Typography variant="body2">No alerts. All clear!</Typography>
            </Box>
          )}

          {!loading &&
            alerts.map((alert) => {
              const cfg = SEVERITY_CONFIG[alert.SEVERITY];
              return (
                <Box
                  key={alert.ALERT_ID}
                  sx={{
                    p: 1.5,
                    mb: 1,
                    borderRadius: 1.5,
                    bgcolor: alert.ACKNOWLEDGED ? "#f8fafc" : cfg.bg,
                    border: `1px solid ${alert.ACKNOWLEDGED ? "#e2e8f0" : cfg.borderColor}`,
                    opacity: alert.ACKNOWLEDGED ? 0.7 : 1,
                    transition: "all 0.2s",
                    "&:hover": { boxShadow: "0 2px 8px rgba(0,0,0,0.08)" },
                  }}
                >
                  {/* Alert header row */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                    <Box sx={{ color: cfg.color }}>{cfg.icon}</Box>
                    <Chip
                      size="small"
                      label={cfg.label}
                      sx={{ bgcolor: cfg.color, color: "#fff", fontSize: 9, height: 18, fontWeight: 700 }}
                    />
                    <Typography variant="caption" sx={{ color: "#64748b" }}>
                      {formatTime(alert.TIMESTAMP)}
                    </Typography>
                    <Chip size="small" label={ACTION_LABELS[alert.ACTION_TYPE] || alert.ACTION_TYPE} variant="outlined" sx={{ fontSize: 9, height: 18 }} />
                    {alert.WILL_BREAK && (
                      <Chip size="small" label="BREAKING" sx={{ bgcolor: "#dc2626", color: "#fff", fontSize: 9, height: 18 }} />
                    )}
                    <Box sx={{ flex: 1 }} />
                    <Typography variant="caption" sx={{ color: "#94a3b8", fontFamily: "monospace" }}>
                      Score: {alert.RISK_SCORE}
                    </Typography>
                  </Box>

                  {/* Source → Affected */}
                  <Typography variant="body2" sx={{ fontWeight: 600, fontSize: 12, mb: 0.3 }}>
                    <span style={{ color: "#475569" }}>{getNodeShortName(alert.SOURCE_NODE)}</span>
                    <span style={{ color: "#94a3b8", margin: "0 6px" }}>→</span>
                    <span style={{ color: cfg.color }}>{getNodeShortName(alert.AFFECTED_NODE)}</span>
                    <span style={{ color: "#94a3b8", marginLeft: 8, fontSize: 10 }}>
                      ({alert.IMPACT_DISTANCE} hop{alert.IMPACT_DISTANCE > 1 ? "s" : ""})
                    </span>
                  </Typography>

                  {/* Description */}
                  <Typography variant="caption" sx={{ color: "#64748b", display: "block", mb: 1 }}>
                    {alert.IMPACT_DESCRIPTION}
                  </Typography>

                  {/* Status badge */}
                  {alert.STATUS === "EXECUTED" && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                      <Chip size="small" label="CHANGE EXECUTED" sx={{ bgcolor: "#7c3aed", color: "#fff", fontSize: 9, height: 18, fontWeight: 700 }} />
                      <Typography variant="caption" sx={{ color: "#7c3aed" }}>
                        by {alert.EXECUTED_BY} {alert.EXECUTED_AT ? `at ${new Date(alert.EXECUTED_AT).toLocaleString()}` : ""}
                      </Typography>
                    </Box>
                  )}
                  {alert.STATUS === "PLANNED" && !alert.ACKNOWLEDGED && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                      <Chip size="small" label="PLANNED" variant="outlined" sx={{ fontSize: 9, height: 18, borderColor: "#f59e0b", color: "#f59e0b" }} />
                      <Typography variant="caption" sx={{ color: "#92400e" }}>
                        Change not yet applied {alert.CREATED_BY ? `— analyzed by ${alert.CREATED_BY}` : ""}
                      </Typography>
                    </Box>
                  )}

                  {/* Acknowledged info */}
                  {alert.ACKNOWLEDGED && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                      <CheckCircleIcon sx={{ fontSize: 14, color: "#22c55e" }} />
                      <Typography variant="caption" sx={{ color: "#22c55e" }}>
                        Acknowledged by {alert.ACKNOWLEDGED_BY} {alert.RESOLUTION_NOTE ? `— "${alert.RESOLUTION_NOTE}"` : ""}
                      </Typography>
                    </Box>
                  )}

                  {/* Action buttons */}
                  {!alert.ACKNOWLEDGED && (
                    <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
                      {onViewInGraph && (
                        <Button
                          size="small"
                          startIcon={<VisibilityIcon />}
                          onClick={() => onViewInGraph(alert.AFFECTED_NODE)}
                          sx={{ textTransform: "none", fontSize: 10, color: "#2563eb" }}
                        >
                          View in Graph
                        </Button>
                      )}
                      {alert.STATUS !== "EXECUTED" && (
                        <Button
                          size="small"
                          onClick={() => handleConfirmChange(alert.ALERT_ID)}
                          sx={{ textTransform: "none", fontSize: 10, color: "#7c3aed", fontWeight: 600 }}
                        >
                          Confirm Change Executed
                        </Button>
                      )}
                      <Button
                        size="small"
                        startIcon={<CheckCircleIcon />}
                        onClick={() => { setAckAlertId(alert.ALERT_ID); setAckDialogOpen(true); }}
                        sx={{ textTransform: "none", fontSize: 10, color: "#16a34a" }}
                      >
                        Acknowledge
                      </Button>
                      <Button
                        size="small"
                        startIcon={<DeleteOutlineIcon />}
                        onClick={() => handleDismiss(alert.ALERT_ID)}
                        sx={{ textTransform: "none", fontSize: 10, color: "#94a3b8" }}
                      >
                        Dismiss
                      </Button>
                    </Box>
                  )}
                </Box>
              );
            })}
        </Box>
      </Collapse>

      {/* Acknowledge Dialog */}
      <Dialog open={ackDialogOpen} onClose={() => setAckDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Acknowledge Alert</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2, color: "#64748b" }}>
            Acknowledging this alert marks it as reviewed. Optionally add a resolution note.
          </Typography>
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Resolution Note (optional)"
            placeholder="e.g., Created a view alias before dropping the table..."
            value={ackNote}
            onChange={(e) => setAckNote(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAckDialogOpen(false)} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleAcknowledge}
            color="success"
            sx={{ textTransform: "none" }}
          >
            Acknowledge
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AlertLoader;
