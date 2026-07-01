import React, { useState } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  Typography,
  Select,
  MenuItem,
  TextField,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  LinearProgress,
  Menu,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorIcon from "@mui/icons-material/Error";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import BoltIcon from "@mui/icons-material/Bolt";
import ShieldIcon from "@mui/icons-material/Shield";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CancelIcon from "@mui/icons-material/Cancel";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import api from "../../../api";

// =============================================================================
// Types
// =============================================================================
type ActionType =
  | "NODE_DELETE"
  | "COLUMN_DELETE"
  | "COLUMN_RENAME"
  | "TYPE_CHANGE"
  | "DEPENDENCY_CHANGE"
  | "NODE_ADD"
  | "COLUMN_ADD"
  | "SOURCE_DISCONNECT"
  | "SCHEMA_MOVE";

interface Impact {
  node: string;
  nodeType: string;
  database: string;
  schema: string;
  name: string;
  distance: number;
  severity: "HIGH" | "MODERATE" | "WARNING";
  riskScore: number;
  willBreak: boolean;
  downstreamCount: number;
  description: string;
}

interface AiSuggestion {
  summary: string;
  steps: string[];
  fullText?: string;
  alternativeApproach?: string | null;
  error?: string;
}

interface AnalysisResult {
  analysisId: string;
  targetObject: string;
  actionType: string;
  riskScore: number;
  totalAffected: number;
  summary: { high: number; moderate: number; warning: number };
  impacts: Impact[];
  externalSourcesInvolved: number;
  executionTimeMs: number;
  aiSuggestion?: AiSuggestion;
}

interface Props {
  selectedNode?: { id: string; database?: string; schema?: string; name?: string } | null;
  onHighlightNodes?: (impacts: { nodeId: string; severity: string }[]) => void;
  onAutoExpand?: (nodeId: string) => Promise<void>;
  onResetHighlights?: () => void;
}

// =============================================================================
// Constants
// =============================================================================
const ACTION_OPTIONS: { value: ActionType; label: string; description: string }[] = [
  { value: "NODE_DELETE", label: "Delete Object", description: "Remove table/view entirely" },
  { value: "COLUMN_DELETE", label: "Drop Column", description: "Remove a column from the table" },
  { value: "COLUMN_RENAME", label: "Rename Column", description: "Change a column name" },
  { value: "TYPE_CHANGE", label: "Change Data Type", description: "Alter column data type" },
  { value: "DEPENDENCY_CHANGE", label: "Change Dependency", description: "Modify source reference" },
  { value: "SOURCE_DISCONNECT", label: "Disconnect Source", description: "Remove external source feed" },
  { value: "SCHEMA_MOVE", label: "Move to Schema", description: "Relocate object to another schema" },
  { value: "NODE_ADD", label: "Add Object", description: "Create new table/view" },
  { value: "COLUMN_ADD", label: "Add Column", description: "Add a new column" },
];

const SEVERITY_CONFIG = {
  HIGH: { color: "#dc2626", bg: "#fef2f2", icon: <ErrorIcon fontSize="small" />, label: "HIGH" },
  MODERATE: { color: "#ea580c", bg: "#fff7ed", icon: <WarningAmberIcon fontSize="small" />, label: "MODERATE" },
  WARNING: { color: "#ca8a04", bg: "#fefce8", icon: <InfoOutlinedIcon fontSize="small" />, label: "WARNING" },
};

// =============================================================================
// Component
// =============================================================================
const ImpactAnalysisPanel: React.FC<Props> = ({ selectedNode, onHighlightNodes, onAutoExpand, onResetHighlights }) => {
  // Form state
  const [actionType, setActionType] = useState<ActionType>("NODE_DELETE");
  const [targetDatabase, setTargetDatabase] = useState("");
  const [targetSchema, setTargetSchema] = useState("");
  const [targetObject, setTargetObject] = useState("");
  const [targetColumn, setTargetColumn] = useState("");
  const [includeAi, setIncludeAi] = useState(true);

  // Result state
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState("");
  const [expandedImpacts, setExpandedImpacts] = useState(true);
  const [expandedAi, setExpandedAi] = useState(true);

  // DDL state
  const [ddlStatements, setDdlStatements] = useState<string[]>([]);
  const [ddlWarning, setDdlWarning] = useState<string | null>(null);
  const [ddlCanExecute, setDdlCanExecute] = useState(false);
  const [ddlLoading, setDdlLoading] = useState(false);
  const [detectedObjectType, setDetectedObjectType] = useState<string | null>(null);
  const [ddlCopied, setDdlCopied] = useState(false);
  const [ddlEditing, setDdlEditing] = useState(false);
  const [ddlEditText, setDdlEditText] = useState("");

  // Execute state
  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState<{ success: boolean; message: string; results?: any[] } | null>(null);
  const [allowMenuAnchor, setAllowMenuAnchor] = useState<HTMLElement | null>(null);

  // Schedule state
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [scheduleResult, setScheduleResult] = useState<{ success: boolean; message: string } | null>(null);

  // Auto-fill from selected node
  React.useEffect(() => {
    if (selectedNode) {
      const parts = selectedNode.id.split(".");
      if (parts.length >= 3) {
        setTargetDatabase(parts[0]);
        setTargetSchema(parts[1]);
        setTargetObject(parts.slice(2).join("."));
      } else {
        setTargetDatabase(selectedNode.database || "");
        setTargetSchema(selectedNode.schema || "");
        setTargetObject(selectedNode.name || selectedNode.id);
      }
    }
  }, [selectedNode]);

  // ---------------------------------------------------------------------------
  // Analyze
  // ---------------------------------------------------------------------------
  const handleAnalyze = async () => {
    if (!targetDatabase || !targetSchema || !targetObject) {
      setError("Please fill in target database, schema, and object.");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    // Reset previous highlights and expansion before new analysis
    if (onResetHighlights) onResetHighlights();
    // Reset DDL state so "Generate DDL" button reappears for the new object
    setDdlStatements([]);
    setDdlWarning(null);
    setDdlCanExecute(false);
    setDetectedObjectType(null);
    setDdlCopied(false);
    setAllowMenuAnchor(null);
    setExecuteResult(null);
    setScheduleOpen(false);
    setScheduleResult(null);

    try {
      const resp = await api.post("/api/impact/analyze", {
        actionType,
        targetDatabase,
        targetSchema,
        targetObject,
        targetColumn: targetColumn || null,
        parameters: {},
        includeAiSuggestion: includeAi,
      });

      setResult(resp.data);

      // Highlight ALL affected nodes on graph with their severity
      if (onHighlightNodes && resp.data.impacts) {
        const allImpacts = resp.data.impacts.map((i: Impact) => ({
          nodeId: i.node,
          severity: i.severity,
        }));
        onHighlightNodes(allImpacts);
      }

      // Auto-expand terminal nodes that are impacted
      if (onAutoExpand && resp.data.impacts) {
        for (const impact of resp.data.impacts) {
          // onAutoExpand will check if the node is terminal internally
          await onAutoExpand(impact.node);
        }
        // Re-apply highlights after expansion
        if (onHighlightNodes) {
          const allImpacts = resp.data.impacts.map((i: Impact) => ({
            nodeId: i.node,
            severity: i.severity,
          }));
          onHighlightNodes(allImpacts);
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Generate DDL
  // ---------------------------------------------------------------------------
  const handleGenerateDDL = async () => {
    setDdlLoading(true);
    setDdlStatements([]);
    setDdlWarning(null);
    try {
      const resp = await api.post("/api/impact/generate-ddl", {
        actionType,
        targetDatabase,
        targetSchema,
        targetObject,
        targetColumn: targetColumn || null,
        parameters: {},
      });
      setDdlStatements(resp.data.ddlStatements || []);
      setDdlWarning(resp.data.warning || null);
      setDdlCanExecute(resp.data.canExecute || false);
      setDetectedObjectType(resp.data.objectType || null);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to generate DDL");
    } finally {
      setDdlLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Copy DDL to clipboard
  // ---------------------------------------------------------------------------
  const handleCopyDDL = () => {
    const text = ddlStatements.join("\n");
    navigator.clipboard.writeText(text);
    setDdlCopied(true);
    setTimeout(() => setDdlCopied(false), 2000);
  };

  // ---------------------------------------------------------------------------
  // Execute DDL (Allow)
  // ---------------------------------------------------------------------------
  const handleExecuteDDL = async () => {
    setExecuting(true);
    setExecuteResult(null);
    setAllowMenuAnchor(null);
    try {
      const resp = await api.post("/api/impact/execute-ddl", {
        ddlStatements,
        analysisId: result?.analysisId || null,
        actionType,
        targetObject: `${targetDatabase}.${targetSchema}.${targetObject}`,
      });
      setExecuteResult(resp.data);
    } catch (err: any) {
      const msg = err?.response?.data?.error || "Execution failed";
      setExecuteResult({ success: false, message: msg });
    } finally {
      setExecuting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Schedule DDL for later
  // ---------------------------------------------------------------------------
  const handleScheduleDDL = async () => {
    if (!scheduledDateTime) return;
    setScheduling(true);
    setScheduleResult(null);
    try {
      const resp = await api.post("/api/impact/schedule-ddl", {
        ddlStatements,
        scheduledAt: scheduledDateTime,
        analysisId: result?.analysisId || null,
        actionType,
        targetObject: `${targetDatabase}.${targetSchema}.${targetObject}`,
      });
      setScheduleResult({ success: true, message: resp.data.message });
      setScheduleOpen(false);
      setScheduledDateTime("");
    } catch (err: any) {
      setScheduleResult({ success: false, message: err?.response?.data?.error || "Scheduling failed" });
    } finally {
      setScheduling(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Risk Score Visual
  // ---------------------------------------------------------------------------
  const getRiskColor = (score: number) => {
    if (score >= 70) return "#dc2626";
    if (score >= 40) return "#ea580c";
    return "#ca8a04";
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Box sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <ShieldIcon sx={{ color: "#4f46e5" }} />
        <Typography variant="h6" sx={{ fontWeight: 700, color: "#1e293b" }}>
          Impact Analysis
        </Typography>
      </Box>

      <Typography variant="body2" sx={{ color: "#64748b", mb: 2 }}>
        Simulate changes and preview their cascading effects before applying them.
      </Typography>

      {/* Form */}
      <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5, mb: 2 }}>
        {/* Action Type */}
        <Box sx={{ gridColumn: "1 / -1" }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: "#475569" }}>
            Action
          </Typography>
          <Select
            fullWidth
            size="small"
            value={actionType}
            onChange={(e) => setActionType(e.target.value as ActionType)}
            sx={{ mt: 0.5 }}
          >
            {ACTION_OPTIONS.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {opt.label}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                    {opt.description}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </Box>

        {/* Target */}
        <TextField
          size="small"
          label="Database"
          value={targetDatabase}
          onChange={(e) => setTargetDatabase(e.target.value)}
        />
        <TextField
          size="small"
          label="Schema"
          value={targetSchema}
          onChange={(e) => setTargetSchema(e.target.value)}
        />
        <TextField
          size="small"
          label="Object (Table/View)"
          value={targetObject}
          onChange={(e) => setTargetObject(e.target.value)}
        />
        <TextField
          size="small"
          label="Column (optional)"
          value={targetColumn}
          onChange={(e) => setTargetColumn(e.target.value)}
          disabled={!["COLUMN_DELETE", "COLUMN_RENAME", "TYPE_CHANGE"].includes(actionType)}
        />
      </Box>

      {/* Actions */}
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 2 }}>
        <Button
          variant="contained"
          onClick={handleAnalyze}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : <BoltIcon />}
          sx={{
            background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
            textTransform: "none",
            fontWeight: 600,
            "&:hover": { background: "linear-gradient(135deg, #4338ca, #6d28d9)" },
          }}
        >
          {loading ? "Analyzing..." : "Analyze Impact"}
        </Button>
        <Tooltip title="Include AI-powered suggestions">
          <Chip
            label="AI Suggestions"
            icon={<AutoAwesomeIcon />}
            size="small"
            color={includeAi ? "primary" : "default"}
            onClick={() => setIncludeAi(!includeAi)}
            variant={includeAi ? "filled" : "outlined"}
          />
        </Tooltip>
      </Box>

      {/* Error */}
      {error && (
        <Box sx={{ p: 1.5, mb: 2, borderRadius: 1, bgcolor: "#fef2f2", border: "1px solid #fecaca" }}>
          <Typography variant="body2" color="error">
            {error}
          </Typography>
        </Box>
      )}

      {/* Results */}
      {result && (
        <Box sx={{ mt: 2 }}>
          {/* Risk Score Header */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 2,
              borderRadius: 2,
              bgcolor: "#f8fafc",
              border: "1px solid #e2e8f0",
              mb: 2,
            }}
          >
            <Box>
              <Typography variant="caption" sx={{ color: "#64748b", fontWeight: 600 }}>
                RISK SCORE
              </Typography>
              <Typography
                variant="h3"
                sx={{ fontWeight: 800, color: getRiskColor(result.riskScore), lineHeight: 1 }}
              >
                {result.riskScore}
                <Typography component="span" variant="body2" sx={{ color: "#94a3b8" }}>
                  /100
                </Typography>
              </Typography>
            </Box>

            <Box sx={{ display: "flex", gap: 1.5 }}>
              {/* Summary cards */}
              <Box sx={{ textAlign: "center", p: 1, borderRadius: 1, bgcolor: SEVERITY_CONFIG.HIGH.bg, minWidth: 60 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: SEVERITY_CONFIG.HIGH.color }}>
                  {result.summary.high}
                </Typography>
                <Typography variant="caption" sx={{ color: SEVERITY_CONFIG.HIGH.color }}>
                  HIGH
                </Typography>
              </Box>
              <Box sx={{ textAlign: "center", p: 1, borderRadius: 1, bgcolor: SEVERITY_CONFIG.MODERATE.bg, minWidth: 60 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: SEVERITY_CONFIG.MODERATE.color }}>
                  {result.summary.moderate}
                </Typography>
                <Typography variant="caption" sx={{ color: SEVERITY_CONFIG.MODERATE.color }}>
                  MODERATE
                </Typography>
              </Box>
              <Box sx={{ textAlign: "center", p: 1, borderRadius: 1, bgcolor: SEVERITY_CONFIG.WARNING.bg, minWidth: 60 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, color: SEVERITY_CONFIG.WARNING.color }}>
                  {result.summary.warning}
                </Typography>
                <Typography variant="caption" sx={{ color: SEVERITY_CONFIG.WARNING.color }}>
                  WARNING
                </Typography>
              </Box>
            </Box>
          </Box>

          {/* Meta info */}
          <Box sx={{ display: "flex", gap: 2, mb: 2, flexWrap: "wrap" }}>
            <Chip size="small" label={`${result.totalAffected} objects affected`} />
            <Chip size="small" label={`${result.externalSourcesInvolved} external sources`} />
            <Chip size="small" label={`${result.executionTimeMs}ms`} variant="outlined" />
          </Box>

          {/* Impact Tree */}
          <Box sx={{ mb: 2, border: "1px solid #e2e8f0", borderRadius: 2, overflow: "hidden" }}>
            <Box
              onClick={() => setExpandedImpacts(!expandedImpacts)}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                p: 1.5,
                bgcolor: "#f1f5f9",
                cursor: "pointer",
                "&:hover": { bgcolor: "#e2e8f0" },
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Impact Tree ({result.impacts.length} nodes)
              </Typography>
              {expandedImpacts ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </Box>

            <Collapse in={expandedImpacts}>
              <Box sx={{ maxHeight: 350, overflowY: "auto", p: 1 }}>
                {result.impacts
                  .sort((a, b) => b.riskScore - a.riskScore)
                  .map((impact, idx) => {
                    const cfg = SEVERITY_CONFIG[impact.severity];
                    return (
                      <Box
                        key={idx}
                        sx={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 1,
                          p: 1,
                          borderRadius: 1,
                          mb: 0.5,
                          bgcolor: cfg.bg,
                          border: `1px solid ${cfg.color}20`,
                          "&:hover": { border: `1px solid ${cfg.color}60` },
                        }}
                      >
                        <Box sx={{ color: cfg.color, mt: 0.3 }}>{cfg.icon}</Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 600, fontFamily: "monospace", fontSize: 11 }}
                              noWrap
                            >
                              {impact.name}
                            </Typography>
                            {impact.willBreak && (
                              <Chip
                                size="small"
                                label="WILL BREAK"
                                sx={{ bgcolor: "#dc2626", color: "#fff", fontSize: 9, height: 18 }}
                              />
                            )}
                            <Chip
                              size="small"
                              label={`${impact.distance} hop${impact.distance > 1 ? "s" : ""}`}
                              variant="outlined"
                              sx={{ fontSize: 9, height: 18 }}
                            />
                          </Box>
                          <Typography variant="caption" sx={{ color: "#64748b", display: "block" }}>
                            {impact.description}
                          </Typography>
                          <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
                            <Typography variant="caption" sx={{ color: "#94a3b8" }}>
                              Risk: {impact.riskScore} | Type: {impact.nodeType} | Downstream: {impact.downstreamCount}
                            </Typography>
                          </Box>
                        </Box>
                        {/* Score bar */}
                        <Box sx={{ width: 50, textAlign: "right" }}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: cfg.color }}>
                            {impact.riskScore}
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={impact.riskScore}
                            sx={{
                              height: 4,
                              borderRadius: 2,
                              bgcolor: "#e2e8f0",
                              "& .MuiLinearProgress-bar": { bgcolor: cfg.color },
                            }}
                          />
                        </Box>
                      </Box>
                    );
                  })}
              </Box>
            </Collapse>
          </Box>

          {/* AI Suggestions */}
          {result.aiSuggestion && !result.aiSuggestion.error && (
            <Box sx={{ border: "1px solid #e2e8f0", borderRadius: 2, overflow: "hidden" }}>
              <Box
                onClick={() => setExpandedAi(!expandedAi)}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  p: 1.5,
                  bgcolor: "#f5f3ff",
                  cursor: "pointer",
                  "&:hover": { bgcolor: "#ede9fe" },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <AutoAwesomeIcon sx={{ color: "#7c3aed", fontSize: 18 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#5b21b6" }}>
                    AI Suggestion
                  </Typography>
                </Box>
                {expandedAi ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </Box>

              <Collapse in={expandedAi}>
                <Box sx={{ p: 2 }}>
                  <Typography variant="body2" sx={{ mb: 1.5, fontWeight: 600 }}>
                    {result.aiSuggestion.summary}
                  </Typography>
                  {result.aiSuggestion.steps.length > 0 && (
                    <Box sx={{ pl: 1 }}>
                      {result.aiSuggestion.steps.map((step, idx) => (
                        <Typography
                          key={idx}
                          variant="body2"
                          sx={{ mb: 0.5, color: "#374151", fontSize: 12 }}
                        >
                          {step}
                        </Typography>
                      ))}
                    </Box>
                  )}
                  {result.aiSuggestion.alternativeApproach && (
                    <Box
                      sx={{ mt: 1.5, p: 1, bgcolor: "#f0fdf4", borderRadius: 1, border: "1px solid #bbf7d0" }}
                    >
                      <Typography variant="caption" sx={{ fontWeight: 600, color: "#166534" }}>
                        Alternative: {result.aiSuggestion.alternativeApproach}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Collapse>
            </Box>
          )}
        </Box>
      )}

      {/* DDL Generation & Execution Section */}
      {result && (
        <Box sx={{ mt: 2, border: "1px solid #e2e8f0", borderRadius: 2, overflow: "hidden" }}>
          <Box sx={{ p: 1.5, bgcolor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                DDL Actions
              </Typography>
              {detectedObjectType && (
                <Chip
                  label={detectedObjectType}
                  size="small"
                  sx={{ fontSize: 10, height: 20, bgcolor: detectedObjectType === "VIEW" ? "#dbeafe" : detectedObjectType === "DYNAMIC TABLE" ? "#ede9fe" : "#f1f5f9", color: detectedObjectType === "VIEW" ? "#1d4ed8" : detectedObjectType === "DYNAMIC TABLE" ? "#6d28d9" : "#475569" }}
                />
              )}
            </Box>
            <Typography variant="caption" sx={{ color: "#64748b" }}>
              Generate and optionally execute the SQL for this change
            </Typography>
          </Box>

          <Box sx={{ p: 2 }}>
            {/* Generate Button */}
            {ddlStatements.length === 0 && (
              <Button
                variant="outlined"
                size="small"
                onClick={handleGenerateDDL}
                disabled={ddlLoading}
                sx={{ textTransform: "none", fontWeight: 600, borderColor: "#4f46e5", color: "#4f46e5" }}
              >
                {ddlLoading ? "Generating..." : "Generate DDL"}
              </Button>
            )}

            {/* DDL Output */}
            {ddlStatements.length > 0 && (
              <Box>
                {/* Warning */}
                {ddlWarning && (
                  <Box sx={{ p: 1.5, mb: 1.5, borderRadius: 1, bgcolor: "#fef3c7", border: "1px solid #fcd34d" }}>
                    <Typography variant="caption" sx={{ color: "#92400e", fontWeight: 600 }}>
                      ⚠ {ddlWarning}
                    </Typography>
                  </Box>
                )}

                {/* SQL Code Block with Edit */}
                <Box sx={{ mb: 1.5 }}>
                  {/* Edit toggle button - above code block */}
                  <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 0.5 }}>
                    <Button
                      size="small"
                      variant={ddlEditing ? "contained" : "outlined"}
                      startIcon={ddlEditing ? <CheckIcon sx={{ fontSize: 16 }} /> : <EditIcon sx={{ fontSize: 16 }} />}
                      onClick={() => {
                        if (ddlEditing) {
                          setDdlStatements(ddlEditText.split("\n").filter(l => l.trim()));
                          setDdlEditing(false);
                        } else {
                          setDdlEditText(ddlStatements.join("\n"));
                          setDdlEditing(true);
                        }
                      }}
                      sx={{
                        textTransform: "none",
                        fontWeight: 700,
                        fontSize: 11,
                        py: 0.3,
                        px: 1.5,
                        color: ddlEditing ? "#fff" : "#92400e",
                        bgcolor: ddlEditing ? "#16a34a" : "#fef3c7",
                        borderColor: ddlEditing ? "#16a34a" : "#fbbf24",
                        "&:hover": { bgcolor: ddlEditing ? "#15803d" : "#fde68a", borderColor: "#f59e0b" },
                      }}
                    >
                      {ddlEditing ? "Save Changes" : "Edit SQL"}
                    </Button>
                  </Box>
                  {ddlEditing ? (
                    <textarea
                      value={ddlEditText}
                      onChange={(e) => setDdlEditText(e.target.value)}
                      style={{
                        width: "100%",
                        minHeight: 120,
                        maxHeight: 200,
                        padding: 12,
                        borderRadius: 4,
                        backgroundColor: "#1e293b",
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "#e2e8f0",
                        border: "2px solid #4ade80",
                        outline: "none",
                        resize: "vertical",
                        boxSizing: "border-box",
                      }}
                    />
                  ) : (
                    <Box
                      sx={{
                        p: 1.5,
                        borderRadius: 1,
                        bgcolor: "#1e293b",
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "#e2e8f0",
                        whiteSpace: "pre-wrap",
                        maxHeight: 150,
                        overflowY: "auto",
                      }}
                    >
                      {ddlStatements.join("\n")}
                    </Box>
                  )}
                </Box>

                {/* Action Buttons — Cortex-style Allow Split Button */}
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", alignItems: "center" }}>
                  {ddlCanExecute && (
                    <ButtonGroup variant="contained" size="small" sx={{ boxShadow: "none" }}>
                      <Button
                        onClick={handleExecuteDDL}
                        disabled={executing}
                        sx={{
                          textTransform: "none",
                          fontWeight: 700,
                          bgcolor: "#16a34a",
                          "&:hover": { bgcolor: "#15803d" },
                          fontSize: 13,
                          px: 2.5,
                        }}
                      >
                        {executing ? "Executing..." : "Allow"}
                      </Button>
                      <Button
                        size="small"
                        onClick={(e) => setAllowMenuAnchor(e.currentTarget)}
                        sx={{
                          bgcolor: "#16a34a",
                          "&:hover": { bgcolor: "#15803d" },
                          minWidth: 28,
                          px: 0.5,
                        }}
                      >
                        <ArrowDropDownIcon sx={{ fontSize: 20, color: "#fff" }} />
                      </Button>
                    </ButtonGroup>
                  )}

                  {!ddlCanExecute && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={handleCopyDDL}
                      sx={{
                        textTransform: "none",
                        fontWeight: 600,
                        borderColor: ddlCopied ? "#16a34a" : "#64748b",
                        color: ddlCopied ? "#16a34a" : "#64748b",
                      }}
                    >
                      {ddlCopied ? "Copied!" : "Copy DDL"}
                    </Button>
                  )}
                </Box>

                {/* Allow Dropdown Menu */}
                <Menu
                  anchorEl={allowMenuAnchor}
                  open={Boolean(allowMenuAnchor)}
                  onClose={() => setAllowMenuAnchor(null)}
                  anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                  transformOrigin={{ vertical: "top", horizontal: "right" }}
                  PaperProps={{ sx: { borderRadius: 2, minWidth: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.15)" } }}
                >
                  <MenuItem onClick={handleExecuteDDL} disabled={executing}>
                    <ListItemIcon><CheckCircleOutlineIcon sx={{ color: "#16a34a" }} /></ListItemIcon>
                    <ListItemText primary="Allow" secondary="Execute now" primaryTypographyProps={{ fontWeight: 600, fontSize: 13 }} secondaryTypographyProps={{ fontSize: 11 }} />
                  </MenuItem>
                  <MenuItem onClick={() => { setAllowMenuAnchor(null); setScheduleOpen(true); }}>
                    <ListItemIcon><ScheduleIcon sx={{ color: "#7c3aed" }} /></ListItemIcon>
                    <ListItemText primary="Schedule for Later" secondary="Set date & time" primaryTypographyProps={{ fontWeight: 600, fontSize: 13 }} secondaryTypographyProps={{ fontSize: 11 }} />
                  </MenuItem>
                  <MenuItem onClick={() => { handleCopyDDL(); setAllowMenuAnchor(null); }}>
                    <ListItemIcon><ContentCopyIcon sx={{ color: "#64748b" }} /></ListItemIcon>
                    <ListItemText primary="Copy & Review" secondary="Copy DDL to clipboard" primaryTypographyProps={{ fontWeight: 600, fontSize: 13 }} secondaryTypographyProps={{ fontSize: 11 }} />
                  </MenuItem>
                  <MenuItem onClick={() => { setAllowMenuAnchor(null); setDdlStatements([]); setDdlWarning(null); }}>
                    <ListItemIcon><CancelIcon sx={{ color: "#dc2626" }} /></ListItemIcon>
                    <ListItemText primary="Cancel" secondary="Discard DDL" primaryTypographyProps={{ fontWeight: 600, fontSize: 13 }} secondaryTypographyProps={{ fontSize: 11 }} />
                  </MenuItem>
                </Menu>

                {/* Execute Result */}
                {executeResult && (
                  <Box sx={{ mt: 1.5, p: 1.5, borderRadius: 1, bgcolor: executeResult.success ? "#f0fdf4" : "#fef2f2", border: `1px solid ${executeResult.success ? "#bbf7d0" : "#fecaca"}` }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: executeResult.success ? "#166534" : "#991b1b" }}>
                      {executeResult.message}
                    </Typography>
                  </Box>
                )}

                {/* Schedule Result */}
                {scheduleResult && (
                  <Box sx={{ mt: 1, p: 1.5, borderRadius: 1, bgcolor: scheduleResult.success ? "#f5f3ff" : "#fef2f2", border: `1px solid ${scheduleResult.success ? "#c4b5fd" : "#fecaca"}` }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, color: scheduleResult.success ? "#5b21b6" : "#991b1b" }}>
                      {scheduleResult.message}
                    </Typography>
                  </Box>
                )}
              </Box>
            )}
          </Box>

          {/* Schedule Dialog (inline) */}
          {scheduleOpen && (
            <Box sx={{ p: 2, borderTop: "1px solid #e2e8f0", bgcolor: "#f5f3ff" }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "#5b21b6", mb: 1 }}>
                Schedule Execution
              </Typography>
              <Typography variant="caption" sx={{ color: "#64748b", display: "block", mb: 1.5 }}>
                Set the date and time when this DDL should be executed automatically.
              </Typography>
              <TextField
                size="small"
                type="datetime-local"
                label="Execute At"
                value={scheduledDateTime}
                onChange={(e) => setScheduledDateTime(e.target.value)}
                fullWidth
                InputLabelProps={{ shrink: true }}
                sx={{ mb: 1.5 }}
                inputProps={{ min: new Date().toISOString().slice(0, 16) }}
              />
              <Box sx={{ display: "flex", gap: 1 }}>
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleScheduleDDL}
                  disabled={scheduling || !scheduledDateTime}
                  sx={{ textTransform: "none", fontWeight: 600, bgcolor: "#7c3aed", "&:hover": { bgcolor: "#6d28d9" } }}
                >
                  {scheduling ? "Scheduling..." : "Confirm Schedule"}
                </Button>
                <Button
                  size="small"
                  onClick={() => { setScheduleOpen(false); setScheduledDateTime(""); }}
                  sx={{ textTransform: "none", color: "#64748b" }}
                >
                  Cancel
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};

export default ImpactAnalysisPanel;
