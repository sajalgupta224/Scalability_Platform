import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  Badge,
  Chip,
  LinearProgress,
  Button,
  Collapse,
} from "@mui/material";
import ScheduleIcon from "@mui/icons-material/Schedule";
import CloseIcon from "@mui/icons-material/Close";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";
import api from "../../../api";

// =============================================================================
// Types
// =============================================================================
interface ScheduledItem {
  ID: string;
  SCHEDULED_AT: string;
  STATUS: string;
  CREATED_BY: string;
  CREATED_AT: string;
  ACTION_TYPE: string;
  TARGET_OBJECT: string;
  ERROR_MESSAGE?: string;
}

// =============================================================================
// Helpers
// =============================================================================
function getTimeRemaining(scheduledAt: string): { total: number; hours: number; minutes: number; seconds: number; progress: number; createdAt?: string } {
  const target = new Date(scheduledAt).getTime();
  const now = Date.now();
  const total = target - now;

  if (total <= 0) return { total: 0, hours: 0, minutes: 0, seconds: 0, progress: 100 };

  const seconds = Math.floor((total / 1000) % 60);
  const minutes = Math.floor((total / 1000 / 60) % 60);
  const hours = Math.floor(total / (1000 * 60 * 60));

  return { total, hours, minutes, seconds, progress: 0 };
}

function getElapsedProgress(createdAt: string, scheduledAt: string): number {
  const created = new Date(createdAt).getTime();
  const target = new Date(scheduledAt).getTime();
  const now = Date.now();

  const totalDuration = target - created;
  if (totalDuration <= 0) return 100;

  const elapsed = now - created;
  return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
}

function formatCountdown(hours: number, minutes: number, seconds: number): string {
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${String(minutes).padStart(2, "0")}m`);
  parts.push(`${String(seconds).padStart(2, "0")}s`);
  return parts.join(" ");
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  PENDING: { color: "#7c3aed", icon: <HourglassTopIcon sx={{ fontSize: 16 }} />, label: "Pending" },
  EXECUTED: { color: "#16a34a", icon: <CheckCircleIcon sx={{ fontSize: 16 }} />, label: "Executed" },
  FAILED: { color: "#dc2626", icon: <ErrorOutlineIcon sx={{ fontSize: 16 }} />, label: "Failed" },
  CANCELLED: { color: "#64748b", icon: <CancelIcon sx={{ fontSize: 16 }} />, label: "Cancelled" },
};

// =============================================================================
// Timer Animation Component
// =============================================================================
const CircularTimer: React.FC<{ progress: number; size?: number }> = ({ progress, size = 40 }) => {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#e2e8f0"
        strokeWidth={3}
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={progress >= 100 ? "#16a34a" : "#7c3aed"}
        strokeWidth={3}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        style={{ transition: "stroke-dashoffset 1s linear" }}
      />
    </svg>
  );
};

// =============================================================================
// Main Component
// =============================================================================
const ScheduledDDLPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ScheduledItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0); // Forces re-render every second

  // Fetch scheduled items
  const fetchScheduled = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await api.get("/api/impact/scheduled");
      setItems(resp.data.data || []);
    } catch (e) {
      console.error("Failed to fetch scheduled DDL:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll every 30 seconds
  useEffect(() => {
    fetchScheduled();
    const interval = setInterval(fetchScheduled, 30000);
    return () => clearInterval(interval);
  }, [fetchScheduled]);

  // Tick every second for countdown timer
  useEffect(() => {
    if (!open) return;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [open]);

  // Cancel a scheduled DDL
  const handleCancel = async (id: string) => {
    try {
      await api.delete(`/api/impact/scheduled/${id}`);
      fetchScheduled();
    } catch (e) {
      console.error("Failed to cancel:", e);
    }
  };

  const pendingCount = items.filter((i) => i.STATUS === "PENDING").length;

  return (
    <>
      {/* Floating Icon Button */}
      <Tooltip title="Scheduled DDL Commands" arrow>
        <IconButton
          onClick={() => { setOpen(!open); if (!open) fetchScheduled(); }}
          sx={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 10,
            bgcolor: open ? "#7c3aed" : "#fff",
            color: open ? "#fff" : "#7c3aed",
            border: "2px solid #7c3aed",
            boxShadow: "0 2px 8px rgba(124, 58, 237, 0.3)",
            width: 40,
            height: 40,
            "&:hover": { bgcolor: open ? "#6d28d9" : "#f5f3ff" },
            transition: "all 0.2s ease",
          }}
        >
          <Badge
            badgeContent={pendingCount}
            color="error"
            sx={{ "& .MuiBadge-badge": { fontSize: 10, minWidth: 16, height: 16 } }}
          >
            <ScheduleIcon sx={{ fontSize: 20 }} />
          </Badge>
        </IconButton>
      </Tooltip>

      {/* Panel */}
      <Collapse in={open}>
        <Box
          sx={{
            position: "absolute",
            top: 60,
            right: 12,
            zIndex: 10,
            width: 380,
            maxHeight: 420,
            bgcolor: "#fff",
            borderRadius: 3,
            boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
            border: "1px solid #e2e8f0",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Header */}
          <Box sx={{ p: 1.5, borderBottom: "1px solid #e2e8f0", display: "flex", alignItems: "center", justifyContent: "space-between", bgcolor: "#f8fafc" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <ScheduleIcon sx={{ fontSize: 18, color: "#7c3aed" }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#1e293b" }}>
                Scheduled DDL
              </Typography>
              {pendingCount > 0 && (
                <Chip label={`${pendingCount} pending`} size="small" sx={{ fontSize: 10, height: 20, bgcolor: "#ede9fe", color: "#7c3aed" }} />
              )}
            </Box>
            <IconButton size="small" onClick={() => setOpen(false)}>
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          {/* Content */}
          <Box sx={{ overflowY: "auto", maxHeight: 360, p: 1.5 }}>
            {loading && items.length === 0 && (
              <Box sx={{ textAlign: "center", py: 3 }}>
                <Typography variant="caption" sx={{ color: "#94a3b8" }}>Loading...</Typography>
              </Box>
            )}

            {!loading && items.length === 0 && (
              <Box sx={{ textAlign: "center", py: 3 }}>
                <ScheduleIcon sx={{ fontSize: 32, color: "#cbd5e1", mb: 1 }} />
                <Typography variant="caption" sx={{ color: "#94a3b8", display: "block" }}>
                  No scheduled DDL commands
                </Typography>
              </Box>
            )}

            {items.map((item) => {
              const statusConf = STATUS_CONFIG[item.STATUS] || STATUS_CONFIG.PENDING;
              const timeLeft = getTimeRemaining(item.SCHEDULED_AT);
              const progress = getElapsedProgress(item.CREATED_AT, item.SCHEDULED_AT);
              const isPending = item.STATUS === "PENDING";
              const isOverdue = isPending && timeLeft.total <= 0;

              return (
                <Box
                  key={item.ID}
                  sx={{
                    mb: 1.5,
                    p: 1.5,
                    borderRadius: 2,
                    border: `1px solid ${isPending ? "#ddd6fe" : "#e2e8f0"}`,
                    bgcolor: isPending ? "#faf5ff" : "#f8fafc",
                    transition: "all 0.2s ease",
                  }}
                >
                  {/* Top row: action + status */}
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Chip
                        label={item.ACTION_TYPE || "DDL"}
                        size="small"
                        sx={{ fontSize: 10, height: 18, fontWeight: 700, bgcolor: "#f1f5f9", color: "#475569" }}
                      />
                    </Box>
                    <Chip
                      icon={statusConf.icon as React.ReactElement}
                      label={statusConf.label}
                      size="small"
                      sx={{ fontSize: 10, height: 20, color: statusConf.color, borderColor: statusConf.color, "& .MuiChip-icon": { color: statusConf.color } }}
                      variant="outlined"
                    />
                  </Box>

                  {/* Target object */}
                  <Typography variant="caption" sx={{ fontWeight: 600, color: "#1e293b", display: "block", fontSize: 11, mb: 0.5, wordBreak: "break-all" }}>
                    {item.TARGET_OBJECT || "Unknown target"}
                  </Typography>

                  {/* Created by + time */}
                  <Typography variant="caption" sx={{ color: "#94a3b8", fontSize: 10, display: "block", mb: 1 }}>
                    by {item.CREATED_BY} · {new Date(item.CREATED_AT).toLocaleString()}
                  </Typography>

                  {/* Timer section (only for PENDING) */}
                  {isPending && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      {/* Circular timer animation */}
                      <CircularTimer progress={progress} size={38} />

                      <Box sx={{ flex: 1 }}>
                        {/* Countdown or Overdue */}
                        {isOverdue ? (
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "#dc2626", fontSize: 12 }}>
                            Overdue — executing soon
                          </Typography>
                        ) : (
                          <Typography variant="caption" sx={{ fontWeight: 700, color: "#7c3aed", fontSize: 13, fontFamily: "monospace" }}>
                            {formatCountdown(timeLeft.hours, timeLeft.minutes, timeLeft.seconds)}
                          </Typography>
                        )}

                        {/* Progress bar */}
                        <LinearProgress
                          variant="determinate"
                          value={progress}
                          sx={{
                            mt: 0.5,
                            height: 4,
                            borderRadius: 2,
                            bgcolor: "#e2e8f0",
                            "& .MuiLinearProgress-bar": {
                              bgcolor: isOverdue ? "#dc2626" : "#7c3aed",
                              borderRadius: 2,
                              transition: "transform 1s linear",
                            },
                          }}
                        />

                        {/* Scheduled time label */}
                        <Typography variant="caption" sx={{ color: "#94a3b8", fontSize: 9, mt: 0.3, display: "block" }}>
                          Executes at {new Date(item.SCHEDULED_AT).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </Typography>
                      </Box>

                      {/* Cancel button */}
                      <Tooltip title="Cancel schedule" arrow>
                        <IconButton
                          size="small"
                          onClick={() => handleCancel(item.ID)}
                          sx={{ color: "#dc2626", "&:hover": { bgcolor: "#fef2f2" } }}
                        >
                          <CancelIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  )}

                  {/* Error message for failed */}
                  {item.STATUS === "FAILED" && item.ERROR_MESSAGE && (
                    <Typography variant="caption" sx={{ color: "#dc2626", fontSize: 10, display: "block", mt: 0.5 }}>
                      Error: {item.ERROR_MESSAGE}
                    </Typography>
                  )}
                </Box>
              );
            })}
          </Box>
        </Box>
      </Collapse>
    </>
  );
};

export default ScheduledDDLPanel;
