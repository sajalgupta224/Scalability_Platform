import { useCallback, useEffect, useRef, useState } from "react";

import {
  Box,
  Button,
  Typography,
  Card,
  CardContent,
  Paper,
  Menu,
  MenuItem, 
  ListItemIcon,
  ListItemText,
  Chip,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import TableChartIcon from "@mui/icons-material/TableChart";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import { ROUTES } from "../../constants";
import api from "../../api";
import LineageGraph, { type ApiResponse } from "./LineageGraph";
import { getGraphById, type LineageGraphConfig } from "./lineageStorage";
import NodeDetailsPanel from "./components/NodeDetailsPanel";
import Lineage360Panel from "./components/Lineage360Panel";
import ImpactAnalysisPanel from "./components/ImpactAnalysisPanel";
import AlertLoader from "./components/AlertLoader";
import ScheduledDDLPanel from "./components/ScheduledDDLPanel";
import type { LineageNodeData } from "./LineageNode";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toPng } from "html-to-image";

const BASE = import.meta.env.VITE_API_BASE_URL || "";

function autoSizeSheetColumns(ws: XLSX.WorkSheet) {
  const ref = ws["!ref"];
  if (!ref) return;
  const range = XLSX.utils.decode_range(ref);
  const colWidths: number[] = [];
  for (let C = range.s.c; C <= range.e.c; ++C) {
    let max = 10;
    for (let R = range.s.r; R <= range.e.r; ++R) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      const v = cell?.v != null ? String(cell.v) : "";
      max = Math.max(max, v.length + 2);
    }
    colWidths.push(max);
  }
  ws["!cols"] = colWidths.map((wch) => ({ wch }));
}

function flattenNodes(nodes: any[]) {
  return (nodes ?? []).map((n: any) => ({
    id: n.id ?? "",
    type: n.type ?? "",
    distance: n.distance ?? "",
    status: n.status ?? "",
  }));
}

function flattenEdges(edges: any[]) {
  return (edges ?? []).map((e: any) => ({
    source: e.source ?? "",
    target: e.target ?? "",
    type: e.type ?? e.label ?? "",
  }));
}

// ─── PDF Export Helpers ───────────────────────────────────────────────────────

interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  tableCount: number;
  viewCount: number;
  columnCount: number;
  upstreamCount: number;
  downstreamCount: number;
  maxDepthReached: number;
  depthDistribution: Record<number, number>;
}

interface ClassifiedData {
  rootFqn: string;
  upstreamNodes: string[];
  downstreamNodes: string[];
  directParents: any[];
  directChildren: any[];
  degreeMap: Map<string, number>;
  hubNodes: { id: string; degree: number }[];
  leafNodes: string[];
  criticalPath: string[];
}

function computeGraphStats(graphData: any, classified: ClassifiedData): GraphStats {
  const nodes = graphData?.nodes ?? [];
  const edges = graphData?.edges ?? [];
  let tableCount = 0, viewCount = 0, columnCount = 0, maxDepth = 0;
  const depthDist: Record<number, number> = {};

  nodes.forEach((n: any) => {
    const t = (n.type || "").toLowerCase();
    if (t.includes("table")) tableCount++;
    else if (t.includes("view")) viewCount++;
    else if (t.includes("column")) columnCount++;
    const d = Number(n.distance) || 0;
    if (d > maxDepth) maxDepth = d;
    depthDist[d] = (depthDist[d] || 0) + 1;
  });

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    tableCount,
    viewCount,
    columnCount,
    upstreamCount: classified.upstreamNodes.length,
    downstreamCount: classified.downstreamNodes.length,
    maxDepthReached: maxDepth,
    depthDistribution: depthDist,
  };
}

function classifyNodes(graphData: any, config: any): ClassifiedData {
  const nodes: any[] = graphData?.nodes ?? [];
  const edges: any[] = graphData?.edges ?? [];

  const rootFqn =
    `${(config.db || "").toUpperCase()}.${(config.schema || "").toUpperCase()}.${(config.objectName || "").toUpperCase()}`;

  // BFS upstream
  const upstreamSet = new Set<string>();
  const upQueue = [rootFqn];
  const upVisited = new Set<string>([rootFqn]);
  while (upQueue.length) {
    const current = upQueue.shift()!;
    edges.forEach((e: any) => {
      if (e.target === current && !upVisited.has(e.source)) {
        upVisited.add(e.source);
        upstreamSet.add(e.source);
        upQueue.push(e.source);
      }
    });
  }

  // BFS downstream
  const downstreamSet = new Set<string>();
  const downQueue = [rootFqn];
  const downVisited = new Set<string>([rootFqn]);
  while (downQueue.length) {
    const current = downQueue.shift()!;
    edges.forEach((e: any) => {
      if (e.source === current && !downVisited.has(e.target)) {
        downVisited.add(e.target);
        downstreamSet.add(e.target);
        downQueue.push(e.target);
      }
    });
  }

  // Direct parents (1 hop upstream)
  const directParents = edges
    .filter((e: any) => e.target === rootFqn)
    .map((e: any) => nodes.find((n: any) => n.id === e.source))
    .filter(Boolean);

  // Direct children (1 hop downstream)
  const directChildren = edges
    .filter((e: any) => e.source === rootFqn)
    .map((e: any) => nodes.find((n: any) => n.id === e.target))
    .filter(Boolean);

  // Degree map
  const degreeMap = new Map<string, number>();
  nodes.forEach((n: any) => degreeMap.set(n.id, 0));
  edges.forEach((e: any) => {
    degreeMap.set(e.source, (degreeMap.get(e.source) || 0) + 1);
    degreeMap.set(e.target, (degreeMap.get(e.target) || 0) + 1);
  });

  // Hub nodes (top 5 by degree)
  const hubNodes = Array.from(degreeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, degree]) => ({ id, degree }));

  // Leaf nodes (degree === 1)
  const leafNodes = Array.from(degreeMap.entries())
    .filter(([, deg]) => deg === 1)
    .map(([id]) => id);

  // Critical path — find deepest node
  const criticalPath: string[] = [];
  let deepestNode = "";
  let deepestDist = 0;
  nodes.forEach((n: any) => {
    const d = Number(n.distance) || 0;
    if (d > deepestDist) {
      deepestDist = d;
      deepestNode = n.id;
    }
  });
  if (deepestNode) {
    criticalPath.push(deepestNode);
    // Trace back towards root
    let current = deepestNode;
    const visited = new Set<string>([current]);
    for (let i = 0; i < deepestDist; i++) {
      const parent = edges.find(
        (e: any) => e.target === current && !visited.has(e.source)
      );
      if (parent) {
        criticalPath.unshift(parent.source);
        visited.add(parent.source);
        current = parent.source;
      } else break;
    }
  }

  return {
    rootFqn,
    upstreamNodes: Array.from(upstreamSet),
    downstreamNodes: Array.from(downstreamSet),
    directParents,
    directChildren,
    degreeMap,
    hubNodes,
    leafNodes,
    criticalPath,
  };
}

function computeInsights(
  graphData: any,
  stats: GraphStats,
  classified: ClassifiedData
): string[] {
  const observations: string[] = [];
  const nodes: any[] = graphData?.nodes ?? [];
  const edges: any[] = graphData?.edges ?? [];

  // Single points of failure
  const spof = Array.from(classified.degreeMap.entries())
    .filter(([id, deg]) => {
      const downEdges = edges.filter((e: any) => e.source === id).length;
      return downEdges >= 3 && deg >= 4;
    })
    .map(([id]) => id);
  if (spof.length > 0) {
    observations.push(
      `Single Points of Failure: ${spof.length} node(s) have 3+ downstream dependents — ${spof.slice(0, 3).join(", ")}${spof.length > 3 ? "..." : ""}`
    );
  }

  // Deep chains
  if (stats.maxDepthReached > 4) {
    observations.push(
      `Deep Lineage Chain: The longest dependency chain is ${stats.maxDepthReached} hops deep. This may cause data freshness or latency concerns.`
    );
  }

  // Stale/missing status
  const staleNodes = nodes.filter(
    (n: any) => n.status && n.status.toLowerCase() !== "active"
  );
  if (staleNodes.length > 0) {
    observations.push(
      `Stale Objects: ${staleNodes.length} node(s) have non-active status — may indicate deprecated or broken objects.`
    );
  }

  // Disconnected nodes
  const disconnected = nodes.filter(
    (n: any) => (classified.degreeMap.get(n.id) || 0) === 0
  );
  if (disconnected.length > 0) {
    observations.push(
      `Disconnected Nodes: ${disconnected.length} node(s) have no edges — possible anomaly in lineage data.`
    );
  }

  // Complexity
  if (stats.totalNodes > 20 && stats.totalEdges > 30) {
    observations.push(
      `High Complexity: Graph has ${stats.totalNodes} nodes and ${stats.totalEdges} edges — consider breaking into smaller lineage scopes for clarity.`
    );
  }

  if (observations.length === 0) {
    observations.push("No significant risks or anomalies detected in this lineage graph.");
  }

  return observations;
}

function generateAISuggestion(
  stats: GraphStats,
  classified: ClassifiedData,
  config: any
): string {
  const lines: string[] = [];
  lines.push(
    `The object "${config.objectName}" in ${config.db}.${config.schema} has ${stats.upstreamCount} upstream dependenc${stats.upstreamCount === 1 ? "y" : "ies"} and ${stats.downstreamCount} downstream consumer${stats.downstreamCount === 1 ? "" : "s"}.`
  );

  if (stats.maxDepthReached > 0) {
    lines.push(
      `The deepest lineage chain reaches ${stats.maxDepthReached} hop${stats.maxDepthReached === 1 ? "" : "s"} from the root.`
    );
  }

  if (classified.leafNodes.length > 0) {
    const leafSample = classified.leafNodes.slice(0, 3).map((id) => {
      const parts = id.split(".");
      return parts[parts.length - 1];
    });
    lines.push(
      `Leaf nodes (${classified.leafNodes.length} total) such as ${leafSample.join(", ")} represent source-of-truth tables or final consumers.`
    );
  }

  if (classified.hubNodes.length > 0 && classified.hubNodes[0].degree > 2) {
    const topHub = classified.hubNodes[0].id.split(".").pop();
    lines.push(
      `The most connected node is "${topHub}" with ${classified.hubNodes[0].degree} connections — this is a critical transformation layer.`
    );
  }

  if (stats.tableCount > 0 && stats.viewCount > 0) {
    lines.push(
      `The lineage comprises ${stats.tableCount} table${stats.tableCount === 1 ? "" : "s"} and ${stats.viewCount} view${stats.viewCount === 1 ? "" : "s"}, indicating a mix of raw storage and transformed layers.`
    );
  }

  return lines.join(" ");
}

// ─── PDF Page Utilities ──────────────────────────────────────────────────────

function addPageHeader(doc: any, pageNum: number, totalPages: number, graphName: string) {
  const pageW = doc.internal.pageSize.getWidth();
  // Thin blue line at top
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.8);
  doc.line(14, 10, pageW - 14, 10);
  // Platform name left
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("AI Scalability Platform", 14, 8);
  // Graph name right
  doc.text(graphName || "", pageW - 14, 8, { align: "right" });
  doc.setTextColor(0);
}

function addPageFooter(doc: any, pageNum: number, totalPages: number, exportDate: string) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setDrawColor(200);
  doc.setLineWidth(0.3);
  doc.line(14, pageH - 12, pageW - 14, pageH - 12);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(130);
  doc.text(`Page ${pageNum} of ${totalPages}`, 14, pageH - 7);
  doc.text(exportDate, pageW - 14, pageH - 7, { align: "right" });
  doc.setTextColor(0);
}

export default function LineageGraphView() {
  const navigate = useNavigate();
  const { graphId } = useParams<{ graphId: string }>();
  const location = useLocation();
  const stateConfig = location.state as LineageGraphConfig | undefined;

  const [config, setConfig] = useState<LineageGraphConfig | null>(stateConfig || null);

  useEffect(() => {
    if (stateConfig || !graphId) return;
    // Try localStorage first (fast)
    const local = getGraphById(graphId);
    if (local) {
      setConfig(local);
      return;
    }
    // Fetch from backend
    const fetchConfig = async () => {
      try {
        const res = await api.get("/graphs");
        const rows = res.data?.data || res.data || [];
        const match = rows.find((r: any) => r.GRAPH_ID === graphId);
        if (match) {
          setConfig({
            id: match.GRAPH_ID,
            graphName: match.GRAPH_NAME,
            db: match.DATABASE_NAME,
            schema: match.SCHEMA_NAME,
            objectType: match.OBJECT_TYPE,
            objectName: match.OBJECT_NAME,
            direction: match.DIRECTION,
            maxDepth: match.DISTANCE != null ? Number(match.DISTANCE) : undefined,
            includeColumn: match.INCLUDE_COLUMN ? "yes" : "no",
            createdAt: match.CREATED_AT,
          });
        }
      } catch {
        // If backend fails, config stays null
      }
    };
    fetchConfig();
  }, [graphId, stateConfig]);

  const graphDataRef = useRef<ApiResponse | null>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [exportReady, setExportReady] = useState(false);
  const [exportAnchor, setExportAnchor] = useState<null | HTMLElement>(null);

  // Node Details Panel state
  const [detailsPanelOpen, setDetailsPanelOpen] = useState(false);
  const [detailsNodeId, setDetailsNodeId] = useState<string | null>(null);
  const [detailsNodeData, setDetailsNodeData] = useState<LineageNodeData | null>(null);

  // Lineage360 AI Panel state
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [aiNodeId, setAiNodeId] = useState<string | null>(null);
  const [aiNodeData, setAiNodeData] = useState<LineageNodeData | null>(null);

  // Impact Analysis Panel state
  const [impactPanelOpen, setImpactPanelOpen] = useState(false);
  const [impactNode, setImpactNode] = useState<{ id: string; database?: string; schema?: string; name?: string } | null>(null);
  const [alertCount, setAlertCount] = useState(0);
  const [highlightedImpacts, setHighlightedImpacts] = useState<Map<string, string>>(new Map());
  const [autoExpandedNodes, setAutoExpandedNodes] = useState<Set<string>>(new Set());
  const [piiData, setPiiData] = useState<Map<string, { piiCount: number; piiStatus: string }>>(new Map());
  const [piiPanelOpen, setPiiPanelOpen] = useState(false);
  const [piiPanelNode, setPiiPanelNode] = useState<{ id: string; database?: string; schema?: string; name?: string } | null>(null);
  const [piiPanelResults, setPiiPanelResults] = useState<any[]>([]);
  const [piiPanelLoading, setPiiPanelLoading] = useState(false);
  const graphRef = useRef<{ exploreFurther: (nodeId: string) => Promise<void>; getNodeIds: () => string[] } | null>(null);

  const handleNodeDetails = useCallback((nodeId: string, nodeData: LineageNodeData) => {
    setDetailsNodeId(nodeId);
    setDetailsNodeData(nodeData);
    setDetailsPanelOpen(true);
    setAiPanelOpen(false);
  }, []);

  const handleImpactAnalysis = useCallback((nodeId: string, nodeData: LineageNodeData) => {
    const parts = nodeId.split(".");
    setImpactNode({
      id: nodeId,
      database: parts[0] || config?.db,
      schema: parts[1] || config?.schema,
      name: parts.slice(2).join(".") || nodeData.label,
    });
    setImpactPanelOpen(true);
    setDetailsPanelOpen(false);
    setAiPanelOpen(false);
    setPiiPanelOpen(false);
  }, [config]);

  const handleScanPII = useCallback((nodeId: string, nodeData: LineageNodeData) => {
    const parts = nodeId.split(".");
    const db = parts[0] || config?.db || "";
    const schema = parts[1] || config?.schema || "";
    const table = parts.slice(2).join(".") || nodeData.label;
    setPiiPanelNode({ id: nodeId, database: db, schema, name: table });
    setPiiPanelOpen(true);
    setDetailsPanelOpen(false);
    setAiPanelOpen(false);
    setImpactPanelOpen(false);
    setPiiPanelLoading(true);
    fetch(`${BASE}/api/pii/by-object?database=${db}&schema=${schema}&table=${table}`)
      .then(res => res.ok ? res.json() : { columns: [] })
      .then(data => setPiiPanelResults(data.columns || []))
      .catch(() => setPiiPanelResults([]))
      .finally(() => setPiiPanelLoading(false));
  }, [config]);

  // Impact highlighting callbacks
  const handleHighlightNodes = useCallback((impacts: { nodeId: string; severity: string }[]) => {
    const newMap = new Map<string, string>();
    impacts.forEach(({ nodeId, severity }) => {
      newMap.set(nodeId, severity);
      newMap.set(nodeId.toUpperCase(), severity); // case-insensitive fallback
    });
    setHighlightedImpacts(newMap);
  }, []);

  const handleAutoExpand = useCallback(async (nodeId: string) => {
    // Check if the node is already in the graph
    if (graphRef.current) {
      const existingIds = graphRef.current.getNodeIds();
      if (!existingIds.includes(nodeId)) {
        // Node is NOT in graph — try to expand from nearest ancestor
        await graphRef.current.exploreFurther(nodeId);
        setAutoExpandedNodes((prev) => new Set([...prev, nodeId]));
      }
    }
  }, []);

  const handleResetHighlights = useCallback(() => {
    setHighlightedImpacts(new Map());
    setAutoExpandedNodes(new Set());
  }, []);

  const handleExplainAI = useCallback((nodeId?: string, nodeData?: LineageNodeData) => {
    if (nodeId && nodeData) {
      setAiNodeId(nodeId);
      setAiNodeData(nodeData);
    } else {
      const rootFqn = `${(config?.db || '').toUpperCase()}.${(config?.schema || '').toUpperCase()}.${(config?.objectName || '').toUpperCase()}`;
      setAiNodeId(rootFqn);
      setAiNodeData({
        label: config?.objectName || '',
        subtitle: config?.objectType || '',
        nodeType: (config?.objectType || '').toLowerCase() as LineageNodeData['nodeType'],
        isRoot: true,
        fullId: rootFqn,
      });
    }
    setAiPanelOpen(true);
    setDetailsPanelOpen(false);
  }, [config]);

  const handleGraphLoaded = useCallback((data: ApiResponse) => {
    graphDataRef.current = data;
    setExportReady(true);

    // Fetch PII data for all nodes in the graph
    if (data?.nodes?.length) {
      const fetchPii = async () => {
        const piiMap = new Map<string, { piiCount: number; piiStatus: string }>();
        const nodeIds = data.nodes.map((n: any) => n.id);
        // Batch: fetch PII summary for each unique table (skip columns)
        const uniqueTables = new Set<string>();
        nodeIds.forEach((id: string) => {
          const parts = id.split(".");
          if (parts.length >= 3) uniqueTables.add(id);
        });

        const promises = Array.from(uniqueTables).map(async (fqn) => {
          const parts = fqn.split(".");
          const [db, schema, table] = [parts[0], parts[1], parts.slice(2).join(".")];
          try {
            const res = await fetch(`${BASE}/api/pii/by-object?database=${db}&schema=${schema}&table=${table}`);
            if (res.ok) {
              const piiInfo = await res.json();
              if (piiInfo.piiCount > 0) {
                piiMap.set(fqn, { piiCount: piiInfo.piiCount, piiStatus: piiInfo.piiStatus });
                piiMap.set(fqn.toUpperCase(), { piiCount: piiInfo.piiCount, piiStatus: piiInfo.piiStatus });
              }
            }
          } catch { /* ignore */ }
        });

        await Promise.all(promises);
        if (piiMap.size > 0) setPiiData(piiMap);
      };
      fetchPii();
    }
  }, []);
  //  exporting in excel fomat 
  const handleExport = useCallback(() => {
    if (!config) return;
    const graphData = graphDataRef.current;
    const wb = XLSX.utils.book_new();
    const selectionRows = [
      { Key: "Graph name", Value: config.graphName },
      { Key: "Database", Value: config.db },
      { Key: "Schema", Value: config.schema },
      { Key: "Object type", Value: config.objectType },
      { Key: "Object name", Value: config.objectName },
      { Key: "Direction", Value: config.direction },
      { Key: "Max depth", Value: config.maxDepth ?? "" },
      { Key: "Include column", Value: (config as any).includeColumn ?? "" },
      { Key: "Column name", Value: (config as any).columnName ?? "" },
      { Key: "Created at", Value: config.createdAt },
    ];
    const selSheet = XLSX.utils.json_to_sheet(selectionRows, { header: ["Key", "Value"] });
    autoSizeSheetColumns(selSheet);
    XLSX.utils.book_append_sheet(wb, selSheet, "Selection");
    if (graphData) {
      const meta = graphData.meta ?? {};
      const metaRows =
        Object.keys(meta).length > 0
          ? Object.entries(meta).map(([k, v]) => ({
              Key: k,
              Value: typeof v === "string" ? v : JSON.stringify(v),
            }))
          : [{ Key: "message", Value: "No meta found." }];
      const metaSheet = XLSX.utils.json_to_sheet(metaRows, { header: ["Key", "Value"] });
      autoSizeSheetColumns(metaSheet);
      XLSX.utils.book_append_sheet(wb, metaSheet, "GraphMeta");
      const nodes = graphData.nodes ?? [];
      const nodesSheet =
        nodes.length > 0
          ? XLSX.utils.json_to_sheet(flattenNodes(nodes))
          : XLSX.utils.aoa_to_sheet([["message"], ["No nodes found"]]);
      autoSizeSheetColumns(nodesSheet);
      XLSX.utils.book_append_sheet(wb, nodesSheet, "Nodes");
      const edges = graphData.edges ?? [];
      const edgesSheet =
        edges.length > 0
          ? XLSX.utils.json_to_sheet(flattenEdges(edges))
          : XLSX.utils.aoa_to_sheet([["message"], ["No edges found"]]);
      autoSizeSheetColumns(edgesSheet);
      XLSX.utils.book_append_sheet(wb, edgesSheet, "Edges");
      const colNodes = (graphData as any).__raw_column_nodes ?? [];
      const colEdges = (graphData as any).__raw_column_edges ?? [];
      const colNodesSheet =
        colNodes.length > 0
          ? XLSX.utils.json_to_sheet(flattenNodes(colNodes))
          : XLSX.utils.aoa_to_sheet([["message"], ["No column nodes"]]);
      autoSizeSheetColumns(colNodesSheet);
      XLSX.utils.book_append_sheet(wb, colNodesSheet, "ColumnNodes");
      const colEdgesSheet =
        colEdges.length > 0
          ? XLSX.utils.json_to_sheet(flattenEdges(colEdges))
          : XLSX.utils.aoa_to_sheet([["message"], ["No column edges"]]);
      autoSizeSheetColumns(colEdgesSheet);
      XLSX.utils.book_append_sheet(wb, colEdgesSheet, "ColumnEdges");
    } else {
      const empty = XLSX.utils.aoa_to_sheet([
        ["message"],
        ["Graph data not loaded yet. Please wait for the graph to load, then export."],
      ]);
      autoSizeSheetColumns(empty);
      XLSX.utils.book_append_sheet(wb, empty, "Graph");
    }
    const dateTag = new Date().toISOString().slice(0, 10);
    const safe = (config.graphName || "lineage_graph").replace(/[^a-zA-Z0-9_-]+/g, "_");
    XLSX.writeFile(wb, `lineage_${safe}_${dateTag}.xlsx`);
  }, [config]);

  const handleExportPdf = useCallback(async () => {
    if (!config) return;
    const graphData = graphDataRef.current;
    const doc = new jsPDF();
    const exportDate = new Date().toLocaleDateString();
    const dateTag = new Date().toISOString().slice(0, 10);
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    // Compute analysis data
    const classified = graphData ? classifyNodes(graphData, config) : null;
    const stats = graphData && classified ? computeGraphStats(graphData, classified) : null;
    const insights = graphData && stats && classified ? computeInsights(graphData, stats, classified) : [];
    const aiSuggestion = stats && classified ? generateAISuggestion(stats, classified, config) : "";

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE 1 — Cover Page
    // ═══════════════════════════════════════════════════════════════════════════

    // Blue gradient header bar
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, pageW, 45, "F");

    // Platform name
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("AI Scalability Platform", pageW / 2, 20, { align: "center" });

    // Subtitle
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(200, 220, 255);
    doc.text("Data Lineage Report", pageW / 2, 30, { align: "center" });

    // Direction badge
    doc.setFontSize(9);
    doc.setTextColor(180, 210, 255);
    doc.text(`Direction: ${config.direction}`, pageW / 2, 38, { align: "center" });

    // Object name (main focus)
    doc.setTextColor(0);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    const objectFqn = `${config.db}.${config.schema}.${config.objectName}`;
    doc.text(objectFqn, pageW / 2, 80, { align: "center", maxWidth: pageW - 30 });

    // Object type badge
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80);
    doc.text(`Object Type: ${config.objectType}`, pageW / 2, 92, { align: "center" });

    // Decorative line
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.5);
    doc.line(60, 100, pageW - 60, 100);

    // Graph name
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30);
    doc.text(config.graphName || "Lineage Insight Engine", pageW / 2, 115, { align: "center" });

    // Export info at bottom
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120);
    doc.text(`Exported on: ${exportDate}`, pageW / 2, pageH - 30, { align: "center" });
    doc.text(`Max Depth: ${config.maxDepth ?? "N/A"} | Include Columns: ${(config as any).includeColumn || "no"}`, pageW / 2, pageH - 22, { align: "center" });

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE 2 — Metadata & Graph Statistics
    // ═══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    let y = 18;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 99, 235);
    doc.text("Configuration & Metadata", 14, y);
    doc.setTextColor(0);
    y += 8;

    const selectionData = [
      ["Database", config.db],
      ["Schema", config.schema],
      ["Object Type", config.objectType],
      ["Object Name", config.objectName],
      ["Direction", config.direction],
      ["Max Depth", String(config.maxDepth ?? "N/A")],
      ["Include Column", (config as any).includeColumn || "no"],
      ["Column Name", (config as any).columnName || "N/A"],
      ["Created At", config.createdAt || "N/A"],
    ];
    autoTable(doc, {
      startY: y,
      head: [["Property", "Value"]],
      body: selectionData,
      theme: "grid",
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      styles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 45 } },
    });

    y = (doc as any).lastAutoTable?.finalY + 14 || 100;

    // Graph Statistics
    if (stats) {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(37, 99, 235);
      doc.text("Graph Statistics", 14, y);
      doc.setTextColor(0);
      y += 8;

      const statsData = [
        ["Total Nodes", String(stats.totalNodes)],
        ["Total Edges", String(stats.totalEdges)],
        ["Tables", String(stats.tableCount)],
        ["Views", String(stats.viewCount)],
        ["Columns", String(stats.columnCount)],
        ["Upstream Nodes", String(stats.upstreamCount)],
        ["Downstream Nodes", String(stats.downstreamCount)],
        ["Max Depth Reached", String(stats.maxDepthReached)],
      ];
      autoTable(doc, {
        startY: y,
        head: [["Metric", "Value"]],
        body: statsData,
        theme: "grid",
        headStyles: { fillColor: [22, 163, 74], textColor: 255 },
        styles: { fontSize: 9 },
        columnStyles: { 0: { fontStyle: "bold", cellWidth: 55 } },
      });

      y = (doc as any).lastAutoTable?.finalY + 14 || y + 80;

      // Depth Distribution
      const depthEntries = Object.entries(stats.depthDistribution).sort(
        (a, b) => Number(a[0]) - Number(b[0])
      );
      if (depthEntries.length > 0) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("Depth Distribution", 14, y);
        y += 6;
        autoTable(doc, {
          startY: y,
          head: [["Hop Distance", "Node Count"]],
          body: depthEntries.map(([depth, count]) => [`Hop ${depth}`, String(count)]),
          theme: "striped",
          headStyles: { fillColor: [79, 70, 229], textColor: 255 },
          styles: { fontSize: 8 },
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE 3 — Graph Visualization + Legend + AI Suggestion
    // ═══════════════════════════════════════════════════════════════════════════
    doc.addPage();
    y = 18;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(37, 99, 235);
    doc.text("Lineage Insight Engine Visualization", 14, y);
    doc.setTextColor(0);
    y += 8;

    // Graph image capture
    if (graphContainerRef.current) {
      try {
        const dataUrl = await toPng(graphContainerRef.current, {
          backgroundColor: "#ffffff",
          quality: 0.95,
        });
        const img = new Image();
        img.src = dataUrl;
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
        });
        const imgWidth = pageW - 28;
        const imgHeight = (img.height / img.width) * imgWidth;

        if (y + imgHeight > pageH - 60) {
          // Scale down if too large
          const maxImgH = pageH - y - 60;
          const scale = Math.min(1, maxImgH / imgHeight);
          doc.addImage(dataUrl, "PNG", 14, y, imgWidth * scale, imgHeight * scale);
          y += imgHeight * scale + 8;
        } else {
          doc.addImage(dataUrl, "PNG", 14, y, imgWidth, imgHeight);
          y += imgHeight + 8;
        }
      } catch {
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text("[Graph image capture failed]", 14, y);
        doc.setTextColor(0);
        y += 8;
      }
    }

    // Legend
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Legend:", 14, y);
    y += 6;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");

    // Table legend
    doc.setFillColor(232, 245, 233);
    doc.setDrawColor(22, 163, 74);
    doc.rect(14, y - 3, 10, 6, "FD");
    doc.text("Table", 28, y + 1);

    // View legend
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(102, 102, 102);
    doc.setLineDashPattern([2, 1], 0);
    doc.rect(60, y - 3, 10, 6, "FD");
    doc.setLineDashPattern([], 0);
    doc.text("View", 74, y + 1);

    // Column legend
    doc.setFillColor(255, 243, 205);
    doc.setDrawColor(255, 152, 0);
    doc.rect(100, y - 3, 10, 6, "FD");
    doc.text("Column", 114, y + 1);

    // Root legend
    doc.setFillColor(227, 242, 253);
    doc.setDrawColor(79, 70, 229);
    doc.setLineWidth(1);
    doc.rect(145, y - 3, 10, 6, "FD");
    doc.setLineWidth(0.5);
    doc.text("Root", 159, y + 1);

    y += 10;

    // Edge color legend
    doc.setDrawColor(239, 68, 68);
    doc.setLineWidth(1.5);
    doc.line(14, y, 24, y);
    doc.text("Upstream", 28, y + 1);

    doc.setDrawColor(6, 182, 212);
    doc.line(60, y, 70, y);
    doc.text("Downstream", 74, y + 1);

    doc.setDrawColor(255, 152, 0);
    doc.line(115, y, 125, y);
    doc.text("Column-level", 129, y + 1);
    doc.setLineWidth(0.5);
    y += 14;

    // AI Suggestion
    if (aiSuggestion) {
      doc.setFillColor(240, 245, 255);
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(0.5);
      const suggestionBoxY = y;
      doc.rect(14, suggestionBoxY, pageW - 28, 4, "F"); // header bar
      doc.setFillColor(248, 250, 255);
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(37, 99, 235);
      doc.text("AI Suggestion", 18, y + 3);
      y += 8;
      doc.setTextColor(50);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      const splitSuggestion = doc.splitTextToSize(aiSuggestion, pageW - 36);
      doc.text(splitSuggestion, 18, y);
      y += splitSuggestion.length * 4 + 6;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE 4 — Impact & Dependency Analysis
    // ═══════════════════════════════════════════════════════════════════════════
    if (classified && graphData) {
      doc.addPage();
      y = 18;

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(37, 99, 235);
      doc.text("Impact & Dependency Analysis", 14, y);
      doc.setTextColor(0);
      y += 10;

      // Root object
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Root Object:", 14, y);
      doc.setFont("helvetica", "normal");
      doc.text(classified.rootFqn, 45, y);
      y += 10;

      // Direct upstream parents
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Direct Upstream Parents (${classified.directParents.length})`, 14, y);
      y += 6;
      if (classified.directParents.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [["Node", "Type"]],
          body: classified.directParents.map((n: any) => [n.id, n.type || "N/A"]),
          theme: "striped",
          headStyles: { fillColor: [239, 68, 68], textColor: 255 },
          styles: { fontSize: 8 },
        });
        y = (doc as any).lastAutoTable?.finalY + 10 || y + 20;
      } else {
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.text("No direct upstream parents found.", 14, y);
        y += 8;
      }

      // Direct downstream children
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Direct Downstream Children (${classified.directChildren.length})`, 14, y);
      y += 6;
      if (classified.directChildren.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [["Node", "Type"]],
          body: classified.directChildren.map((n: any) => [n.id, n.type || "N/A"]),
          theme: "striped",
          headStyles: { fillColor: [6, 182, 212], textColor: 255 },
          styles: { fontSize: 8 },
        });
        y = (doc as any).lastAutoTable?.finalY + 10 || y + 20;
      } else {
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.text("No direct downstream children found.", 14, y);
        y += 8;
      }

      // Check if we need a new page
      if (y > pageH - 80) {
        doc.addPage();
        y = 18;
      }

      // Hub Nodes
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`Hub Nodes (Most Connected — Top ${Math.min(5, classified.hubNodes.length)})`, 14, y);
      y += 6;
      if (classified.hubNodes.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [["Node", "Connections"]],
          body: classified.hubNodes.map((h) => [h.id, String(h.degree)]),
          theme: "striped",
          headStyles: { fillColor: [79, 70, 229], textColor: 255 },
          styles: { fontSize: 8 },
        });
        y = (doc as any).lastAutoTable?.finalY + 10 || y + 20;
      }

      // Leaf Nodes
      if (classified.leafNodes.length > 0) {
        if (y > pageH - 60) {
          doc.addPage();
          y = 18;
        }
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`Leaf Nodes (${classified.leafNodes.length} — Terminal Endpoints)`, 14, y);
        y += 6;
        const leafDisplay = classified.leafNodes.slice(0, 15);
        autoTable(doc, {
          startY: y,
          head: [["Node"]],
          body: leafDisplay.map((id) => [id]),
          theme: "striped",
          headStyles: { fillColor: [34, 197, 94], textColor: 255 },
          styles: { fontSize: 8 },
        });
        y = (doc as any).lastAutoTable?.finalY + 10 || y + 20;
        if (classified.leafNodes.length > 15) {
          doc.setFontSize(7);
          doc.setFont("helvetica", "italic");
          doc.text(`... and ${classified.leafNodes.length - 15} more leaf nodes.`, 14, y);
          y += 6;
        }
      }

      // Critical Path
      if (classified.criticalPath.length > 1) {
        if (y > pageH - 60) {
          doc.addPage();
          y = 18;
        }
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`Critical Path (Longest Chain — ${classified.criticalPath.length} nodes)`, 14, y);
        y += 6;
        autoTable(doc, {
          startY: y,
          head: [["Step", "Node"]],
          body: classified.criticalPath.map((id, idx) => [String(idx + 1), id]),
          theme: "striped",
          headStyles: { fillColor: [220, 38, 38], textColor: 255 },
          styles: { fontSize: 8 },
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE 5 — Node Detail Table
    // ═══════════════════════════════════════════════════════════════════════════
    if (graphData && graphData.nodes?.length > 0) {
      doc.addPage();
      y = 18;

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(37, 99, 235);
      doc.text("Node Details", 14, y);
      doc.setTextColor(0);
      y += 8;

      const nodeRows = (graphData.nodes ?? []).map((n: any) => {
        const direction = classified
          ? n.id === classified.rootFqn
            ? "ROOT"
            : classified.upstreamNodes.includes(n.id)
              ? "UPSTREAM"
              : classified.downstreamNodes.includes(n.id)
                ? "DOWNSTREAM"
                : "—"
          : "—";
        const degree = classified ? (classified.degreeMap.get(n.id) || 0) : 0;
        const shortName = (n.id || "").split(".").pop() || n.id;
        return [shortName, n.type || "—", String(n.distance ?? "—"), direction, n.status || "—", String(degree)];
      });

      autoTable(doc, {
        startY: y,
        head: [["Short Name", "Type", "Distance", "Direction", "Status", "Connections"]],
        body: nodeRows,
        theme: "striped",
        headStyles: { fillColor: [37, 99, 235], textColor: 255 },
        styles: { fontSize: 7, cellPadding: 2 },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 22 },
          2: { cellWidth: 18 },
          3: { cellWidth: 28 },
          4: { cellWidth: 22 },
          5: { cellWidth: 22 },
        },
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE 6 — Edge Detail Table
    // ═══════════════════════════════════════════════════════════════════════════
    if (graphData && graphData.edges?.length > 0) {
      doc.addPage();
      y = 18;

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(37, 99, 235);
      doc.text("Edge Details", 14, y);
      doc.setTextColor(0);
      y += 8;

      const edgeRows = (graphData.edges ?? []).map((e: any) => {
        const srcShort = (e.source || "").split(".").pop() || e.source;
        const tgtShort = (e.target || "").split(".").pop() || e.target;
        return [srcShort, e.source || "", tgtShort, e.target || "", e.type || e.label || "—"];
      });

      autoTable(doc, {
        startY: y,
        head: [["Source (Short)", "Source (FQN)", "Target (Short)", "Target (FQN)", "Type"]],
        body: edgeRows,
        theme: "striped",
        headStyles: { fillColor: [37, 99, 235], textColor: 255 },
        styles: { fontSize: 7, cellPadding: 2 },
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE 7 — Column Lineage (conditional)
    // ═══════════════════════════════════════════════════════════════════════════
    const colNodes = (graphData as any)?.__raw_column_nodes ?? [];
    const colEdges = (graphData as any)?.__raw_column_edges ?? [];
    if (((config as any).includeColumn === "yes") && (colNodes.length > 0 || colEdges.length > 0)) {
      doc.addPage();
      y = 18;

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(37, 99, 235);
      doc.text("Column Lineage", 14, y);
      doc.setTextColor(0);
      y += 8;

      if (colNodes.length > 0) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`Column Nodes (${colNodes.length})`, 14, y);
        y += 6;
        autoTable(doc, {
          startY: y,
          head: [["Column ID", "Type", "Distance"]],
          body: colNodes.map((n: any) => [n.id || "", n.type || "", String(n.distance ?? "")]),
          theme: "striped",
          headStyles: { fillColor: [255, 152, 0], textColor: 255 },
          styles: { fontSize: 7 },
        });
        y = (doc as any).lastAutoTable?.finalY + 10 || y + 20;
      }

      if (colEdges.length > 0) {
        if (y > pageH - 40) {
          doc.addPage();
          y = 18;
        }
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(`Column Edges (${colEdges.length})`, 14, y);
        y += 6;
        autoTable(doc, {
          startY: y,
          head: [["Source Column", "Target Column", "Type"]],
          body: colEdges.map((e: any) => [e.source || "", e.target || "", e.type || ""]),
          theme: "striped",
          headStyles: { fillColor: [255, 152, 0], textColor: 255 },
          styles: { fontSize: 7 },
        });
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // PAGE 8 — Observations & Recommendations
    // ═══════════════════════════════════════════════════════════════════════════
    if (insights.length > 0) {
      doc.addPage();
      y = 18;

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(37, 99, 235);
      doc.text("Observations & Recommendations", 14, y);
      doc.setTextColor(0);
      y += 10;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      insights.forEach((obs, idx) => {
        if (y > pageH - 30) {
          doc.addPage();
          y = 18;
        }
        doc.setFont("helvetica", "bold");
        doc.text(`${idx + 1}.`, 14, y);
        doc.setFont("helvetica", "normal");
        const lines = doc.splitTextToSize(obs, pageW - 36);
        doc.text(lines, 22, y);
        y += lines.length * 4.5 + 6;
      });

      // Summary footer
      y += 6;
      if (y < pageH - 40) {
        doc.setDrawColor(37, 99, 235);
        doc.setLineWidth(0.3);
        doc.line(14, y, pageW - 14, y);
        y += 8;
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.setFont("helvetica", "italic");
        doc.text(
          "This report was auto-generated by the AI Scalability Platform lineage analysis engine.",
          14,
          y
        );
        doc.text(
          "Observations are derived from graph topology and may require human validation.",
          14,
          y + 5
        );
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Apply headers & footers to all pages
    // ═══════════════════════════════════════════════════════════════════════════
    const totalPages = doc.getNumberOfPages();
    for (let i = 2; i <= totalPages; i++) {
      doc.setPage(i);
      addPageHeader(doc, i, totalPages, config.graphName || "");
      addPageFooter(doc, i, totalPages, exportDate);
    }
    // Cover page footer only
    doc.setPage(1);
    addPageFooter(doc, 1, totalPages, exportDate);

    // Save
    const safe = (config.graphName || "lineage_graph").replace(/[^a-zA-Z0-9_-]+/g, "_");
    doc.save(`lineage_${safe}_${dateTag}.pdf`);
  }, [config]);

  if (!config) {
    // needs to be fixed 
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          Graph not found
        </Typography>
        <Button variant="contained" onClick={() => navigate(ROUTES.LINEAGE_GRAPH)}>
          Back to Lineage Explorer
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* graph header component  */}
      <Paper
        elevation={0}
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
          p: 2.5,
          px: 3,
          borderRadius: 3,
          border: "1px solid",
          borderColor: "#bfdbfe",
          background: "linear-gradient(135deg, #f8faff 0%, #eff6ff 100%)",
        }}
      >
        {/* Left: Icon + Title + metadata chips */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2.5,
              background: "linear-gradient(135deg, #2563eb, #1d4ed8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <AccountTreeIcon sx={{ color: "#fff", fontSize: 22 }} />
          </Box>
          <Box>
            <Typography
              variant="h6"
              
              sx={{
                fontWeight: 700,
                fontSize: "1.15rem",
                lineHeight: 1.3,
                color: "#1e3a5f",
              }}
            >

              {config.graphName}
            </Typography>
            <Box sx={{ display: "flex", gap: 0.75, mt: 0.5, flexWrap: "wrap" }}>
              <Chip
                label={config.db}
                size="small"
                sx={{
                  height: 22,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  bgcolor: "#dbeafe",
                  color: "#1d4ed8",
                }}
              />
              <Chip
                label={config.schema}
                size="small"
                sx={{
                  height: 22,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  bgcolor: "#e0f2fe",
                  color: "#0369a1",
                }}
              />
              <Chip
                label={config.objectType}
                size="small"
                sx={{
                  height: 22,
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  bgcolor: "#eff6ff",
                  color: "#1e40af",
                }}
              />
              <Chip
                label={config.direction}
                size="small"
                variant="outlined"
                sx={{
                  height: 22,
                  fontSize: "0.7rem",
                  fontWeight: 500,
                  borderColor: "#93c5fd",
                  color: "#1d4ed8",
                }}
              />
            </Box>
          </Box>
        </Box>

        {/* Right: Actions */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Button
            variant="contained"
            disableElevation
            endIcon={<KeyboardArrowDownIcon />}
            startIcon={<DownloadOutlinedIcon />}
            onClick={(e) => setExportAnchor(e.currentTarget)}
            disabled={!exportReady}
            sx={{
              textTransform: "none",
              borderRadius: 2.5,
              px: 2.5,
              py: 1,
              fontWeight: 600,
              fontSize: "0.85rem",
              background: "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)",
              boxShadow: "0 2px 8px rgba(37, 99, 235, 0.3)",
              "&:hover": {
                background: "linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)",
                boxShadow: "0 4px 12px rgba(37, 99, 235, 0.4)",
              },
              "&.Mui-disabled": {
                background: "#e2e8f0",
                color: "#94a3b8",
              },
            }}
          >
            Export
          </Button>
          <Menu
            anchorEl={exportAnchor}
            open={Boolean(exportAnchor)}
            onClose={() => setExportAnchor(null)}
            transformOrigin={{ horizontal: "right", vertical: "top" }}
            anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
            PaperProps={{
              sx: {
                mt: 1,
                borderRadius: 2.5,
                minWidth: 180,
                boxShadow: "0 10px 40px rgba(0,0,0,0.12)",
                border: "1px solid",
                borderColor: "#bfdbfe",
              },
            }}
          >
            <MenuItem
              onClick={() => {
                setExportAnchor(null);
                handleExport();
              }}
              sx={{ py: 1.2, px: 2, borderRadius: 1.5, mx: 0.5 }}
            >
              <ListItemIcon>
                <TableChartIcon sx={{ color: "#16a34a" }} />
              </ListItemIcon>
              <ListItemText
                primary="Excel (.xlsx)"
                secondary="Spreadsheet with all data"
                primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: 600 }}
                secondaryTypographyProps={{ fontSize: "0.7rem" }}
              />
            </MenuItem>
            <MenuItem
              onClick={() => {
                setExportAnchor(null);
                handleExportPdf();
              }}
              sx={{ py: 1.2, px: 2, borderRadius: 1.5, mx: 0.5 }}
            >
              <ListItemIcon>
                <PictureAsPdfIcon sx={{ color: "#dc2626" }} />
              </ListItemIcon>
              <ListItemText
                primary="PDF (.pdf)"
                secondary="Formatted report document"
                primaryTypographyProps={{ fontSize: "0.875rem", fontWeight: 600 }}
                secondaryTypographyProps={{ fontSize: "0.7rem" }}
              />
            </MenuItem>
          </Menu>

          <Tooltip title="Back to Lineage Explorer">
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate(ROUTES.LINEAGE_GRAPH)}
              sx={{
                textTransform: "none",
                borderRadius: 2.5,
                px: 2,
                py: 1,
                fontWeight: 600,
                fontSize: "0.85rem",
                borderColor: "#93c5fd",
                color: "#1d4ed8",
                "&:hover": {
                  borderColor: "#2563eb",
                  bgcolor: "#eff6ff",
                },
              }}
            >
              Back
            </Button>
          </Tooltip>
        </Box>
      </Paper>
      {/* graph component  */}
      <Card sx={{ borderRadius: 3, boxShadow: 2 }}>
        <CardContent sx={{ position: "relative" }}>
          <ScheduledDDLPanel />
          <LineageGraph
            isPanelOpen={true}
            apiBase="http://localhost:5000"
            db={config.db}  
            schema={config.schema}
            objectType={config.objectType}
            objectName={config.objectName}
            direction={config.direction}
            maxDepth={config.maxDepth}
            includeColumn={(config as any).includeColumn}
            columnName={(config as any).columnName}
            onDataLoaded={handleGraphLoaded}
            graphContainerRef={graphContainerRef}
            onNodeDetails={handleNodeDetails}
            onExplainAI={handleExplainAI}
            onImpactAnalysis={handleImpactAnalysis}
            onScanPII={handleScanPII}
            highlightedNodes={highlightedImpacts}
            piiData={piiData}
            ref={graphRef}
          />
        </CardContent>
      </Card>

      {/* Node Details Panel */}
      <NodeDetailsPanel
        isOpen={detailsPanelOpen}
        onClose={() => setDetailsPanelOpen(false)}
        nodeId={detailsNodeId}
        nodeData={detailsNodeData}
      />

      {/* Lineage360 AI Panel */}
      <Lineage360Panel
        isOpen={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        nodeId={aiNodeId}
        nodeData={aiNodeData}
      />

      {/* Impact Analysis Panel (slide-in from right) */}
      <Box
        sx={{
          position: "fixed",
          top: 0,
          right: 0,
          width: impactPanelOpen ? 520 : 0,
          minWidth: impactPanelOpen ? 400 : 0,
          maxWidth: "70vw",
          height: "100vh",
          bgcolor: "#fff",
          boxShadow: impactPanelOpen ? "-4px 0 24px rgba(0,0,0,0.12)" : "none",
          zIndex: 1200,
          overflow: "hidden",
          transition: "width 0.3s ease",
          resize: impactPanelOpen ? "horizontal" : "none",
          direction: "rtl",
        }}
      >
        <Box sx={{ width: "100%", height: "100%", overflowY: "auto", direction: "ltr" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2, borderBottom: "1px solid #e2e8f0" }}>
            <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 16 }}>Impact Analysis</Typography>
            <Button size="small" onClick={() => setImpactPanelOpen(false)} sx={{ minWidth: 32, color: "#64748b" }}>✕</Button>
          </Box>
          <ImpactAnalysisPanel
            selectedNode={impactNode}
            onHighlightNodes={handleHighlightNodes}
            onAutoExpand={handleAutoExpand}
            onResetHighlights={handleResetHighlights}
          />
        </Box>
      </Box>

      {/* PII Scan Panel (slide-in from right) */}
      <Box
        sx={{
          position: "fixed",
          top: 0,
          right: 0,
          width: piiPanelOpen ? 480 : 0,
          minWidth: piiPanelOpen ? 360 : 0,
          maxWidth: "60vw",
          height: "100vh",
          bgcolor: "#fff",
          boxShadow: piiPanelOpen ? "-4px 0 24px rgba(0,0,0,0.12)" : "none",
          zIndex: 1200,
          overflow: "hidden",
          transition: "width 0.3s ease",
          resize: piiPanelOpen ? "horizontal" : "none",
          direction: "rtl",
        }}
      >
        <Box sx={{ width: "100%", height: "100%", overflowY: "auto", direction: "ltr" }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", p: 2, borderBottom: "1px solid #e2e8f0" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Box sx={{ width: 28, height: 28, borderRadius: 1.5, bgcolor: "#f5f3ff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Typography sx={{ fontSize: 14 }}>🛡️</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: 14, lineHeight: 1.2 }}>PII Scan</Typography>
                <Typography variant="caption" color="text.secondary">{piiPanelNode?.name || ""}</Typography>
              </Box>
            </Box>
            <Button size="small" onClick={() => setPiiPanelOpen(false)} sx={{ minWidth: 32, color: "#64748b" }}>✕</Button>
          </Box>
          <Box sx={{ p: 2 }}>
            {piiPanelLoading ? (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <CircularProgress size={24} sx={{ color: "#7c3aed" }} />
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Scanning for PII...</Typography>
              </Box>
            ) : piiPanelResults.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 4 }}>
                <Typography variant="body2" color="text.secondary">No PII detected in this table.</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                  Run a full scan from the Data Privacy tab to detect PII columns.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="caption" fontWeight={700} color="#7c3aed">
                    {piiPanelResults.length} PII column{piiPanelResults.length !== 1 ? "s" : ""} found
                  </Typography>
                  <Chip
                    label={piiPanelResults.filter((r: any) => r.STATUS === "DETECTED").length > 0 ? "Unprotected" : "Protected"}
                    size="small"
                    color={piiPanelResults.filter((r: any) => r.STATUS === "DETECTED").length > 0 ? "error" : "success"}
                    variant="outlined"
                    sx={{ height: 20, fontSize: "0.65rem" }}
                  />
                </Box>
                {piiPanelResults.map((col: any, idx: number) => (
                  <Box
                    key={idx}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      px: 1.5,
                      py: 1,
                      borderRadius: 1.5,
                      bgcolor: col.STATUS === "MASKED" ? "#f0fdf4" : "#fef2f2",
                      border: `1px solid ${col.STATUS === "MASKED" ? "#bbf7d0" : "#fecaca"}`,
                    }}
                  >
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontSize: "0.775rem", fontWeight: 600, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {col.COLUMN_NAME}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {col.CONFIDENCE}% confidence
                      </Typography>
                    </Box>
                    <Chip label={col.PII_TYPE} size="small" sx={{ height: 20, fontSize: "0.6rem", fontWeight: 700, bgcolor: col.STATUS === "MASKED" ? "#dcfce7" : "#fee2e2", color: col.STATUS === "MASKED" ? "#16a34a" : "#dc2626" }} />
                    <Chip label={col.STATUS === "MASKED" ? "Protected" : "Exposed"} size="small" sx={{ height: 18, fontSize: "0.55rem", fontWeight: 600, bgcolor: col.STATUS === "MASKED" ? "#16a34a" : "#dc2626", color: "#fff" }} />
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* Alert Loader (bottom bar) */}
      <Box sx={{ mt: 3 }}>
        <AlertLoader
          onAlertCountChange={(count) => setAlertCount(count)}
          onViewInGraph={(nodeId) => {
            // Could scroll/highlight the node in graph
            console.log("[Alert] View in graph:", nodeId);
          }}
        />
      </Box>
    </Box>
  );
}