import { useState, useEffect, useCallback, useRef } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  FormControl,
  InputLabel,
  LinearProgress,
  Tabs,
  Tab,
  Autocomplete,
} from "@mui/material";
import SecurityIcon from "@mui/icons-material/Security";
import ShieldIcon from "@mui/icons-material/Shield";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import HistoryIcon from "@mui/icons-material/History";
import RefreshIcon from "@mui/icons-material/Refresh";
import DeleteIcon from "@mui/icons-material/Delete";
import BlockIcon from "@mui/icons-material/Block";
import StopCircleIcon from "@mui/icons-material/StopCircle";
import { SemanticViewAPI } from "../../api/endpoints/semanticView.api";

const BASE = import.meta.env.VITE_API_BASE_URL || "";

interface PiiResult {
  ID: string;
  SCAN_ID: string;
  DATABASE_NAME: string;
  SCHEMA_NAME: string;
  TABLE_NAME: string;
  COLUMN_NAME: string;
  PII_TYPE: string;
  CONFIDENCE: number;
  STATUS: string;
  IS_MASKED: boolean;
  MASKING_POLICY_NAME: string | null;
  DETECTED_AT: string;
}

interface ScanHistory {
  SCAN_ID: string;
  DATABASE_NAME: string;
  SCHEMA_NAME: string;
  TABLE_NAME: string | null;
  SCANNED_BY: string;
  STARTED_AT: string;
  COMPLETED_AT: string | null;
  TABLES_SCANNED: number;
  TABLES_TOTAL: number;
  COLUMNS_SCANNED: number;
  PII_FOUND: number;
  STATUS: string;
}

interface Summary {
  TABLES_WITH_PII: number;
  TOTAL_PII_COLUMNS: number;
  UNPROTECTED: number;
  MASKED: number;
  IGNORED: number;
  COMPLIANCE_SCORE: number;
  byType: { PII_TYPE: string; COUNT: number }[];
}

const PII_TYPE_COLORS: Record<string, string> = {
  EMAIL: "#2196f3",
  PHONE: "#9c27b0",
  SSN: "#f44336",
  CREDIT_CARD: "#e91e63",
  NAME: "#ff9800",
  ADDRESS: "#4caf50",
  IP_ADDRESS: "#607d8b",
  DOB: "#795548",
};

const MASK_TYPES = [
  { value: "FULL", label: "Full Mask (********)" },
  { value: "PARTIAL", label: "Partial (ab****cd)" },
  { value: "HASH", label: "Hash (SHA-256)" },
  { value: "REDACT", label: "Redact ([REDACTED])" },
];

export default function PIIScanner() {
  const [tab, setTab] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [results, setResults] = useState<PiiResult[]>([]);
  const [history, setHistory] = useState<ScanHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [activeScanId, setActiveScanId] = useState<string | null>(null);
  const [scanProgress, setScanProgress] = useState<{ percent: number; tablesScanned: number; tablesTotal: number; eta: number | null; piiFound: number } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Scan form
  const [scanDb, setScanDb] = useState("D_IN_CAPG_POC_AI_SCALABILITY");
  const [scanSchema, setScanSchema] = useState("AI_SCALABILITY_SCHEMA");
  const [scanTable, setScanTable] = useState("");

  // Dropdown options
  const [databases, setDatabases] = useState<string[]>([]);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [loadingDbs, setLoadingDbs] = useState(false);
  const [loadingSchemas, setLoadingSchemas] = useState(false);
  const [loadingTables, setLoadingTables] = useState(false);

  // Mask dialog
  const [maskDialogOpen, setMaskDialogOpen] = useState(false);
  const [maskTarget, setMaskTarget] = useState<PiiResult | null>(null);
  const [maskType, setMaskType] = useState("FULL");
  const [masking, setMasking] = useState(false);

  // Scan detail dialog (view PII results for a specific scan)
  const [scanDetailOpen, setScanDetailOpen] = useState(false);
  const [scanDetailResults, setScanDetailResults] = useState<PiiResult[]>([]);
  const [scanDetailLoading, setScanDetailLoading] = useState(false);
  const [scanDetailScanId, setScanDetailScanId] = useState<string | null>(null);

  // Load databases on mount
  useEffect(() => {
    setLoadingDbs(true);
    SemanticViewAPI.getDatabases()
      .then((dbs) => setDatabases(dbs))
      .catch(() => setDatabases([]))
      .finally(() => setLoadingDbs(false));
  }, []);

  // Load schemas when database changes
  useEffect(() => {
    if (!scanDb) { setSchemas([]); setScanSchema(""); return; }
    setLoadingSchemas(true);
    SemanticViewAPI.getSchemas(scanDb)
      .then((schs) => setSchemas(schs))
      .catch(() => setSchemas([]))
      .finally(() => setLoadingSchemas(false));
  }, [scanDb]);

  // Load tables when schema changes
  useEffect(() => {
    if (!scanDb || !scanSchema) { setTables([]); setScanTable(""); return; }
    setLoadingTables(true);
    SemanticViewAPI.getTablesBySchema(scanDb, scanSchema)
      .then((tbls) => setTables(tbls))
      .catch(() => setTables([]))
      .finally(() => setLoadingTables(false));
  }, [scanDb, scanSchema]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/pii/summary`);
      const data = await res.json();
      setSummary(data);
    } catch (e) {
      console.error("Summary fetch error:", e);
    }
  }, []);

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/pii/results`);
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Results fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/pii/history`);
      const data = await res.json();
      setHistory(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("History fetch error:", e);
    }
  }, []);

  useEffect(() => {
    fetchSummary();
    fetchResults();
    fetchHistory();
  }, [fetchSummary, fetchResults, fetchHistory]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback((scanId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${BASE}/api/pii/progress/${scanId}`);
        if (!res.ok) return;
        const data = await res.json();
        setScanProgress({ percent: data.percent, tablesScanned: data.tablesScanned, tablesTotal: data.tablesTotal, eta: data.eta, piiFound: data.piiFound });
        fetchHistory(); // refresh history table to show live progress
        if (data.status !== "RUNNING") {
          stopPolling();
          setScanning(false);
          setActiveScanId(null);
          setScanProgress(null);
          if (data.status === "COMPLETED") {
            setSuccess(`Scan complete! Found ${data.piiFound} PII columns across ${data.tablesScanned} tables.`);
          } else if (data.status === "CANCELLED") {
            setSuccess(`Scan cancelled at ${data.tablesScanned}/${data.tablesTotal} tables.`);
          }
          fetchSummary();
          fetchResults();
          fetchHistory();
        }
      } catch { /* ignore */ }
    }, 3000);
  }, [stopPolling, fetchSummary, fetchResults, fetchHistory]);

  useEffect(() => { return () => stopPolling(); }, [stopPolling]);

  const handleScan = async () => {
    setScanning(true);
    setError("");
    setSuccess("");
    setScanProgress(null);
    try {
      const res = await fetch(`${BASE}/api/pii/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          database: scanDb,
          schema: scanSchema,
          table: scanTable || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setActiveScanId(data.scanId);
        setScanProgress({ percent: 0, tablesScanned: 0, tablesTotal: data.totalTables, eta: null, piiFound: 0 });
        startPolling(data.scanId);
        fetchHistory();
      } else {
        setError(data.error || "Scan failed");
        setScanning(false);
      }
    } catch (e: any) {
      setError(e.message);
      setScanning(false);
    }
  };

  const handleCancelScan = async (scanId: string) => {
    try {
      await fetch(`${BASE}/api/pii/cancel/${scanId}`, { method: "POST" });
      stopPolling();
      setScanning(false);
      setActiveScanId(null);
      setScanProgress(null);
      setSuccess("Scan cancelled.");
      fetchHistory();
    } catch { /* ignore */ }
  };

  const handleViewScanResults = async (scanId: string) => {
    setScanDetailScanId(scanId);
    setScanDetailOpen(true);
    setScanDetailLoading(true);
    try {
      const res = await fetch(`${BASE}/api/pii/results?scanId=${scanId}`);
      const data = await res.json();
      setScanDetailResults(Array.isArray(data) ? data : []);
    } catch {
      setScanDetailResults([]);
    } finally {
      setScanDetailLoading(false);
    }
  };

  const handleMask = async () => {
    if (!maskTarget) return;
    setMasking(true);
    try {
      const res = await fetch(`${BASE}/api/pii/mask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resultId: maskTarget.ID,
          database: maskTarget.DATABASE_NAME,
          schema: maskTarget.SCHEMA_NAME,
          table: maskTarget.TABLE_NAME,
          column: maskTarget.COLUMN_NAME,
          piiType: maskTarget.PII_TYPE,
          maskType,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Masking policy applied to ${maskTarget.TABLE_NAME}.${maskTarget.COLUMN_NAME}`);
        setMaskDialogOpen(false);
        fetchResults();
        fetchSummary();
      } else {
        setError(data.error || "Masking failed");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setMasking(false);
    }
  };

  const handleIgnore = async (resultId: string) => {
    try {
      await fetch(`${BASE}/api/pii/ignore`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId }),
      });
      fetchResults();
      fetchSummary();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUnmask = async (row: PiiResult) => {
    try {
      const res = await fetch(`${BASE}/api/pii/unmask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          database: row.DATABASE_NAME,
          schema: row.SCHEMA_NAME,
          table: row.TABLE_NAME,
          column: row.COLUMN_NAME,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(`Unmasked ${row.TABLE_NAME}.${row.COLUMN_NAME} — policy removed.`);
        fetchResults();
        fetchSummary();
      } else {
        setError(data.error || "Unmask failed");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1400, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3, gap: 2 }}>
        <SecurityIcon sx={{ fontSize: 36, color: "#7c3aed" }} />
        <Box>
          <Typography variant="h5" fontWeight={700}>
            PII Scanner & Data Privacy
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Detect, classify, and protect personally identifiable information across your data pipeline
          </Typography>
        </Box>
      </Box>

      {/* KPI Cards */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 2, mb: 3 }}>
        <Card sx={{ bgcolor: "#fef2f2", border: "1px solid #fecaca" }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">Tables with PII</Typography>
            <Typography variant="h4" fontWeight={700} color="#dc2626">
              {summary?.TABLES_WITH_PII ?? "—"}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ bgcolor: "#fff7ed", border: "1px solid #fed7aa" }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">PII Columns</Typography>
            <Typography variant="h4" fontWeight={700} color="#ea580c">
              {summary?.TOTAL_PII_COLUMNS ?? "—"}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ bgcolor: "#fefce8", border: "1px solid #fde047" }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">Unprotected</Typography>
            <Typography variant="h4" fontWeight={700} color="#ca8a04">
              {summary?.UNPROTECTED ?? "—"}
            </Typography>
          </CardContent>
        </Card>
        <Card sx={{ bgcolor: "#f0fdf4", border: "1px solid #bbf7d0" }}>
          <CardContent>
            <Typography variant="caption" color="text.secondary">Compliance Score</Typography>
            <Typography variant="h4" fontWeight={700} color="#16a34a">
              {summary?.COMPLIANCE_SCORE != null ? `${summary.COMPLIANCE_SCORE}%` : "—"}
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Scan Controls */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            <SearchIcon sx={{ fontSize: 18, mr: 1, verticalAlign: "middle" }} />
            Scan for PII
          </Typography>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
            <Autocomplete
              size="small"
              options={databases}
              value={scanDb || null}
              onChange={(_, v) => { setScanDb(v || ""); setScanSchema(""); setScanTable(""); }}
              loading={loadingDbs}
              sx={{ minWidth: 250 }}
              renderInput={(params) => <TextField {...params} label="Database" />}
            />
            <Autocomplete
              size="small"
              options={schemas}
              value={scanSchema || null}
              onChange={(_, v) => { setScanSchema(v || ""); setScanTable(""); }}
              loading={loadingSchemas}
              disabled={!scanDb}
              sx={{ minWidth: 220 }}
              renderInput={(params) => <TextField {...params} label="Schema" />}
            />
            <Autocomplete
              size="small"
              options={tables}
              value={scanTable || null}
              onChange={(_, v) => setScanTable(v || "")}
              loading={loadingTables}
              disabled={!scanSchema}
              sx={{ minWidth: 280 }}
              renderInput={(params) => <TextField {...params} label="Table (optional - blank for full schema)" />}
            />
            <Button
              variant="contained"
              startIcon={scanning ? <CircularProgress size={16} color="inherit" /> : <SearchIcon />}
              onClick={handleScan}
              disabled={scanning || !scanDb || !scanSchema}
              sx={{
                bgcolor: "#7c3aed",
                "&:hover": { bgcolor: "#6d28d9" },
                textTransform: "none",
                fontWeight: 600,
              }}
            >
              {scanning ? "Scanning..." : "Scan Now"}
            </Button>
          </Box>
          {scanning && scanProgress && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 0.5 }}>
                <Typography variant="body2" fontWeight={600} color="#7c3aed">
                  {scanProgress.percent}% ({scanProgress.tablesScanned}/{scanProgress.tablesTotal} tables)
                </Typography>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  {scanProgress.eta != null && (
                    <Typography variant="caption" color="text.secondary">
                      ETA: ~{scanProgress.eta >= 3600
                        ? `${Math.floor(scanProgress.eta / 3600)}h ${Math.floor((scanProgress.eta % 3600) / 60)}m`
                        : scanProgress.eta >= 60
                          ? `${Math.floor(scanProgress.eta / 60)}m ${scanProgress.eta % 60}s`
                          : `${scanProgress.eta}s`}
                    </Typography>
                  )}
                  {scanProgress.piiFound > 0 && (
                    <Chip label={`${scanProgress.piiFound} PII found`} size="small" color="warning" sx={{ height: 20, fontSize: "0.65rem" }} />
                  )}
                  {activeScanId && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="error"
                      startIcon={<StopCircleIcon sx={{ fontSize: 14 }} />}
                      onClick={() => handleCancelScan(activeScanId)}
                      sx={{ textTransform: "none", fontSize: "0.7rem", py: 0.25, minHeight: 24 }}
                    >
                      Stop
                    </Button>
                  )}
                </Box>
              </Box>
              <LinearProgress
                variant="determinate"
                value={scanProgress.percent}
                sx={{ height: 8, borderRadius: 4, "& .MuiLinearProgress-bar": { bgcolor: "#7c3aed", borderRadius: 4 } }}
              />
            </Box>
          )}
          {scanning && !scanProgress && <LinearProgress sx={{ mt: 2, "& .MuiLinearProgress-bar": { bgcolor: "#7c3aed" } }} />}
        </CardContent>
      </Card>

      {/* Alerts */}
      {error && <Alert severity="error" onClose={() => setError("")} sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" onClose={() => setSuccess("")} sx={{ mb: 2 }}>{success}</Alert>}

      {/* Tabs */}
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Scan Results" icon={<ShieldIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
        <Tab label="Scan History" icon={<HistoryIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
        <Tab label="PII Distribution" icon={<WarningAmberIcon sx={{ fontSize: 18 }} />} iconPosition="start" />
      </Tabs>

      {/* Tab: Scan Results */}
      {tab === 0 && (
        <Card>
          <CardContent sx={{ p: 0 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2, pb: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                {results.length} PII column{results.length !== 1 ? "s" : ""} detected
              </Typography>
              <IconButton size="small" onClick={fetchResults}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Box>
            {loading ? (
              <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor: "#f8fafc" }}>
                      <TableCell sx={{ fontWeight: 600 }}>Table</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Column</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>PII Type</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Confidence</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {results.map((row) => (
                      <TableRow key={row.ID} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>{row.TABLE_NAME}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {row.DATABASE_NAME}.{row.SCHEMA_NAME}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">{row.COLUMN_NAME}</Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={row.PII_TYPE}
                            size="small"
                            sx={{
                              bgcolor: PII_TYPE_COLORS[row.PII_TYPE] || "#666",
                              color: "#fff",
                              fontWeight: 600,
                              fontSize: "0.7rem",
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                            <LinearProgress
                              variant="determinate"
                              value={row.CONFIDENCE}
                              sx={{
                                width: 60,
                                height: 6,
                                borderRadius: 3,
                                bgcolor: "#e2e8f0",
                                "& .MuiLinearProgress-bar": {
                                  bgcolor: row.CONFIDENCE >= 90 ? "#dc2626" : row.CONFIDENCE >= 70 ? "#ea580c" : "#ca8a04",
                                },
                              }}
                            />
                            <Typography variant="caption">{row.CONFIDENCE}%</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          {row.STATUS === "DETECTED" && (
                            <Chip label="Unprotected" size="small" color="error" variant="outlined" icon={<WarningAmberIcon />} />
                          )}
                          {row.STATUS === "MASKED" && (
                            <Chip label="Masked" size="small" color="success" variant="outlined" icon={<CheckCircleIcon />} />
                          )}
                          {row.STATUS === "IGNORED" && (
                            <Chip label="Ignored" size="small" variant="outlined" icon={<BlockIcon />} />
                          )}
                        </TableCell>
                        <TableCell>
                          {row.STATUS === "DETECTED" && (
                            <Box sx={{ display: "flex", gap: 0.5 }}>
                              <Tooltip title="Apply Masking Policy">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => { setMaskTarget(row); setMaskDialogOpen(true); }}
                                >
                                  <VisibilityOffIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Ignore (False Positive)">
                                <IconButton size="small" onClick={() => handleIgnore(row.ID)}>
                                  <BlockIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          )}
                          {row.STATUS === "MASKED" && (
                            <Tooltip title="Remove masking policy">
                              <IconButton
                                size="small"
                                color="warning"
                                onClick={() => handleUnmask(row)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {results.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ textAlign: "center", py: 4 }}>
                          <Typography color="text.secondary">
                            No PII detected yet. Run a scan to get started.
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}

      {/* Tab: Scan History */}
      {tab === 1 && (
        <Card>
          <CardContent sx={{ p: 0 }}>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: "#f8fafc" }}>
                    <TableCell sx={{ fontWeight: 600 }}>Scan Target</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Scanned By</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Started</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Tables</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>PII Found</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.map((row) => (
                    <TableRow key={row.SCAN_ID} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>
                          {row.TABLE_NAME || `${row.SCHEMA_NAME}.*`}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.DATABASE_NAME}.{row.SCHEMA_NAME}
                        </Typography>
                      </TableCell>
                      <TableCell>{row.SCANNED_BY}</TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {new Date(row.STARTED_AT + "Z").toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>{row.TABLES_SCANNED}</TableCell>
                      <TableCell>
                        <Chip
                          label={row.PII_FOUND}
                          size="small"
                          color={row.PII_FOUND > 0 ? "warning" : "default"}
                          onClick={row.PII_FOUND > 0 ? () => handleViewScanResults(row.SCAN_ID) : undefined}
                          sx={row.PII_FOUND > 0 ? { cursor: "pointer", "&:hover": { boxShadow: "0 0 6px rgba(245,158,11,0.5)" } } : {}}
                        />
                      </TableCell>
                      <TableCell>
                        {row.STATUS === "RUNNING" ? (
                          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 140 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={row.TABLES_TOTAL > 0 ? (row.TABLES_SCANNED / row.TABLES_TOTAL) * 100 : 0}
                                sx={{ flex: 1, height: 6, borderRadius: 3, "& .MuiLinearProgress-bar": { bgcolor: "#7c3aed" } }}
                              />
                              <Typography variant="caption" fontWeight={600} color="#7c3aed" sx={{ minWidth: 32 }}>
                                {row.TABLES_TOTAL > 0 ? Math.round((row.TABLES_SCANNED / row.TABLES_TOTAL) * 100) : 0}%
                              </Typography>
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <Typography variant="caption" color="text.secondary">
                                {row.TABLES_SCANNED}/{row.TABLES_TOTAL} tables
                              </Typography>
                              <Button
                                size="small"
                                color="error"
                                variant="text"
                                startIcon={<StopCircleIcon sx={{ fontSize: 12 }} />}
                                onClick={() => handleCancelScan(row.SCAN_ID)}
                                sx={{ textTransform: "none", fontSize: "0.65rem", py: 0, minHeight: 20, px: 0.5 }}
                              >
                                Stop
                              </Button>
                            </Box>
                          </Box>
                        ) : (
                          <Chip
                            label={row.STATUS === "CANCELLED" ? `Cancelled (${row.TABLES_SCANNED}/${row.TABLES_TOTAL})` : row.STATUS}
                            size="small"
                            color={
                              row.STATUS === "COMPLETED" ? "success" :
                              row.STATUS === "CANCELLED" ? "default" : "error"
                            }
                            variant="outlined"
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {history.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ textAlign: "center", py: 4 }}>
                        <Typography color="text.secondary">No scan history yet.</Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Tab: PII Distribution */}
      {tab === 2 && (
        <Card>
          <CardContent>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
              PII Types Distribution
            </Typography>
            {summary?.byType && summary.byType.length > 0 ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {summary.byType.map((item) => (
                  <Box key={item.PII_TYPE} sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Chip
                      label={item.PII_TYPE}
                      size="small"
                      sx={{
                        bgcolor: PII_TYPE_COLORS[item.PII_TYPE] || "#666",
                        color: "#fff",
                        fontWeight: 600,
                        minWidth: 100,
                      }}
                    />
                    <LinearProgress
                      variant="determinate"
                      value={(item.COUNT / (summary?.TOTAL_PII_COLUMNS || 1)) * 100}
                      sx={{
                        flex: 1,
                        height: 10,
                        borderRadius: 5,
                        bgcolor: "#e2e8f0",
                        "& .MuiLinearProgress-bar": {
                          bgcolor: PII_TYPE_COLORS[item.PII_TYPE] || "#666",
                          borderRadius: 5,
                        },
                      }}
                    />
                    <Typography variant="body2" fontWeight={600} sx={{ minWidth: 30 }}>
                      {item.COUNT}
                    </Typography>
                  </Box>
                ))}
              </Box>
            ) : (
              <Typography color="text.secondary">No PII data available. Run a scan first.</Typography>
            )}
          </CardContent>
        </Card>
      )}

      {/* Mask Dialog */}
      <Dialog open={maskDialogOpen} onClose={() => setMaskDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <VisibilityOffIcon color="primary" />
          Apply Masking Policy
        </DialogTitle>
        <DialogContent>
          {maskTarget && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="body2" sx={{ mb: 2 }}>
                Protect <strong>{maskTarget.TABLE_NAME}.{maskTarget.COLUMN_NAME}</strong> ({maskTarget.PII_TYPE})
              </Typography>
              <FormControl fullWidth size="small">
                <InputLabel>Masking Type</InputLabel>
                <Select
                  value={maskType}
                  label="Masking Type"
                  onChange={(e) => setMaskType(e.target.value)}
                >
                  {MASK_TYPES.map((mt) => (
                    <MenuItem key={mt.value} value={mt.value}>{mt.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Alert severity="info" sx={{ mt: 2 }}>
                A masking policy will be created and applied to this column.
                Only SYSADMIN and ACCOUNTADMIN roles will see the original values.
              </Alert>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMaskDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleMask}
            disabled={masking}
            startIcon={masking ? <CircularProgress size={16} /> : <ShieldIcon />}
            sx={{ bgcolor: "#7c3aed", "&:hover": { bgcolor: "#6d28d9" } }}
          >
            {masking ? "Applying..." : "Apply Policy"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Scan Detail Dialog — View PII results for a specific scan */}
      <Dialog open={scanDetailOpen} onClose={() => setScanDetailOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1, borderBottom: "1px solid #e5e7eb" }}>
          <ShieldIcon sx={{ color: "#7c3aed" }} />
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>Scan Results</Typography>
            <Typography variant="caption" color="text.secondary">
              Scan ID: {scanDetailScanId?.slice(0, 8)}...
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {scanDetailLoading ? (
            <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>
          ) : scanDetailResults.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <Typography color="text.secondary">No PII found in this scan.</Typography>
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, bgcolor: "#f8fafc" }}>Table</TableCell>
                    <TableCell sx={{ fontWeight: 600, bgcolor: "#f8fafc" }}>Column</TableCell>
                    <TableCell sx={{ fontWeight: 600, bgcolor: "#f8fafc" }}>PII Type</TableCell>
                    <TableCell sx={{ fontWeight: 600, bgcolor: "#f8fafc" }}>Confidence</TableCell>
                    <TableCell sx={{ fontWeight: 600, bgcolor: "#f8fafc" }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600, bgcolor: "#f8fafc" }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {scanDetailResults.map((row) => (
                    <TableRow key={row.ID} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{row.TABLE_NAME}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.DATABASE_NAME}.{row.SCHEMA_NAME}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">{row.COLUMN_NAME}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={row.PII_TYPE} size="small" sx={{ bgcolor: PII_TYPE_COLORS[row.PII_TYPE] || "#666", color: "#fff", fontWeight: 600, fontSize: "0.7rem" }} />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <LinearProgress variant="determinate" value={row.CONFIDENCE} sx={{ width: 50, height: 5, borderRadius: 3, bgcolor: "#e2e8f0", "& .MuiLinearProgress-bar": { bgcolor: row.CONFIDENCE >= 90 ? "#dc2626" : row.CONFIDENCE >= 70 ? "#ea580c" : "#ca8a04" } }} />
                          <Typography variant="caption">{row.CONFIDENCE}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {row.STATUS === "DETECTED" && <Chip label="Unprotected" size="small" color="error" variant="outlined" icon={<WarningAmberIcon />} />}
                        {row.STATUS === "MASKED" && <Chip label="Masked" size="small" color="success" variant="outlined" icon={<CheckCircleIcon />} />}
                        {row.STATUS === "IGNORED" && <Chip label="Ignored" size="small" variant="outlined" icon={<BlockIcon />} />}
                      </TableCell>
                      <TableCell>
                        {row.STATUS === "DETECTED" && (
                          <Box sx={{ display: "flex", gap: 0.5 }}>
                            <Tooltip title="Apply Masking Policy">
                              <IconButton size="small" color="primary" onClick={() => { setMaskTarget(row); setMaskDialogOpen(true); }}>
                                <VisibilityOffIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Ignore (False Positive)">
                              <IconButton size="small" onClick={() => { handleIgnore(row.ID); setScanDetailResults(prev => prev.map(r => r.ID === row.ID ? { ...r, STATUS: "IGNORED" } : r)); }}>
                                <BlockIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}
                        {row.STATUS === "MASKED" && (
                          <Tooltip title="Remove masking policy">
                            <IconButton size="small" color="warning" onClick={() => { handleUnmask(row); setScanDetailResults(prev => prev.map(r => r.ID === row.ID ? { ...r, STATUS: "DETECTED" } : r)); }}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScanDetailOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
