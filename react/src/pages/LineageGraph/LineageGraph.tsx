import { useEffect, useState, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import api from '../../api';
import LineageNode, { type LineageNodeData } from './LineageNode';
import AnimatedFlowEdge from './AnimatedFlowEdge';
import { CircularProgress, Box, Typography, TextField, InputAdornment, ToggleButtonGroup, ToggleButton, Tooltip, IconButton, Button } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import NorthIcon from '@mui/icons-material/North';
import SouthIcon from '@mui/icons-material/South';
import SyncAltIcon from '@mui/icons-material/SyncAlt';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import BoltIcon from '@mui/icons-material/Bolt';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';


/**
 * Compute which node IDs should be hidden due to collapsed nodes.
 * BFS in both directions from each collapsed node; nodes reachable from root
 * without passing through a collapsed node stay visible (diamond deps).
 * Also returns per-collapsed-node hidden count.
 */
function computeCollapseState(
  collapsedNodes: Set<string>,
  rawEdges: { source: string; target: string }[],
  rootFqn: string
): { hiddenSet: Set<string>; hiddenCounts: Map<string, number> } {
  const hiddenSet = new Set<string>();
  const hiddenCounts = new Map<string, number>();
  if (collapsedNodes.size === 0) return { hiddenSet, hiddenCounts };

  // Build adjacency
  const downstream = new Map<string, string[]>();
  const upstream = new Map<string, string[]>();
  for (const e of rawEdges) {
    if (!downstream.has(e.source)) downstream.set(e.source, []);
    downstream.get(e.source)!.push(e.target);
    if (!upstream.has(e.target)) upstream.set(e.target, []);
    upstream.get(e.target)!.push(e.source);
  }

  // For each collapsed node, BFS its sub-tree in both directions
  const perNodeHidden = new Map<string, Set<string>>();
  for (const collapsedId of collapsedNodes) {
    const subtree = new Set<string>();
    // Downstream BFS
    const queue = [collapsedId];
    const visited = new Set<string>([collapsedId]);
    while (queue.length) {
      const current = queue.shift()!;
      for (const child of (downstream.get(current) || [])) {
        if (!visited.has(child)) {
          visited.add(child);
          if (child !== rootFqn) subtree.add(child);
          queue.push(child);
        }
      }
    }
    // Upstream BFS
    const queueUp = [collapsedId];
    const visitedUp = new Set<string>([collapsedId]);
    while (queueUp.length) {
      const current = queueUp.shift()!;
      for (const parent of (upstream.get(current) || [])) {
        if (!visitedUp.has(parent)) {
          visitedUp.add(parent);
          if (parent !== rootFqn) subtree.add(parent);
          queueUp.push(parent);
        }
      }
    }
    perNodeHidden.set(collapsedId, subtree);
  }

  // Find nodes reachable from root without passing through any collapsed node
  const reachable = new Set<string>();
  const rQueue = [rootFqn];
  reachable.add(rootFqn);
  while (rQueue.length) {
    const current = rQueue.shift()!;
    if (current !== rootFqn && collapsedNodes.has(current)) continue;
    for (const neighbor of [...(downstream.get(current) || []), ...(upstream.get(current) || [])]) {
      if (!reachable.has(neighbor)) {
        reachable.add(neighbor);
        rQueue.push(neighbor);
      }
    }
  }

  // Hidden = in any subtree AND not reachable from root
  const allHiddenCandidates = new Set<string>();
  for (const subtree of perNodeHidden.values()) {
    for (const id of subtree) allHiddenCandidates.add(id);
  }
  for (const id of allHiddenCandidates) {
    if (!reachable.has(id)) hiddenSet.add(id);
  }

  // Compute per-collapsed-node hidden counts
  for (const [collapsedId, subtree] of perNodeHidden) {
    let count = 0;
    for (const id of subtree) {
      if (hiddenSet.has(id)) count++;
    }
    hiddenCounts.set(collapsedId, count);
  }

  return { hiddenSet, hiddenCounts };
}

export type Direction = 'UPSTREAM' | 'DOWNSTREAM' | 'BOTH';
export type ObjectType = 'TABLE' | 'VIEW' | 'COLUMN';

export type ApiNode = {
  id: string;
  type?: string;
  distance?: number;
  status?: string | null;
  [k: string]: any;
};

export type ApiEdge = {
  source: string;
  target: string;
  [k: string]: any;
};

export type ApiResponse = {
  nodes: ApiNode[];
  edges: ApiEdge[];
  meta?: {
    db?: string;
    schema?: string;
    objectName?: string;
    objectType?: ObjectType | string;
    direction?: Direction;
    maxDepth?: number;
    [k: string]: any;
  };
};

export interface LineageGraphProps {
  db: string;
  schema: string;
  apiBase: string;
  objectType: ObjectType;
  objectName: string;
  direction?: Direction;
  maxDepth?: number;
  includeColumn?: 'yes' | 'no';
  columnName?: string;
  isPanelOpen?: boolean;
  onDataLoaded?: (data: ApiResponse) => void;
  graphContainerRef?: React.RefObject<HTMLDivElement | null>;
  onNodeDetails?: (nodeId: string, nodeData: LineageNodeData) => void;
  onExplainAI?: (nodeId?: string, nodeData?: LineageNodeData) => void;
  onImpactAnalysis?: (nodeId: string, nodeData: LineageNodeData) => void;
  onScanPII?: (nodeId: string, nodeData: LineageNodeData) => void;
  highlightedNodes?: Map<string, string>;
  piiData?: Map<string, { piiCount: number; piiStatus: string }>;
  ref?: React.Ref<{ exploreFurther: (nodeId: string) => Promise<void>; getNodeIds: () => string[] }>;
}

// Edge & node classification colors
const UPSTREAM_COLOR = '#ef4444';
const DOWNSTREAM_COLOR = '#06b6d4';
const COLUMN_COLOR = '#ff9800';

const nodeTypes = { lineage: LineageNode };
const edgeTypes = { animatedFlow: AnimatedFlowEdge };

/** Inner component that auto-fits the viewport when the trigger value changes */
function AutoFitOnChange({ trigger }: { trigger: number }) {
  const { fitView } = useReactFlow();
  useEffect(() => {
    if (trigger > 0) {
      fitView({ padding: 0.2, duration: 300 });
    }
  }, [trigger, fitView]);
  return null;
}

const LineageGraph = forwardRef(function LineageGraph({
  db,
  schema,
  objectType,
  objectName,
  direction,
  maxDepth,
  includeColumn = 'no',
  columnName,
  isPanelOpen = true,
  onDataLoaded,
  graphContainerRef,
  onNodeDetails,
  onExplainAI,
  onImpactAnalysis,
  onScanPII,
  highlightedNodes,
  piiData,
}: Omit<LineageGraphProps, 'ref'>, ref: React.Ref<{ exploreFurther: (nodeId: string) => Promise<void>; getNodeIds: () => string[] }>) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [legendItems, setLegendItems] = useState<Set<string>>(new Set());

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);


  const rawEdgesRef = useRef<{ source: string; target: string }[]>([]);
  const rootFqnRef = useRef<string>('');
  const nodeClassificationRef = useRef<Map<string, string>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [streamFilter, setStreamFilter] = useState<'upstream' | 'downstream' | 'both'>(
    (direction || 'BOTH').toLowerCase() as 'upstream' | 'downstream' | 'both'
  );
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [popupNode, setPopupNode] = useState<{ id: string; x: number; y: number } | null>(null);
  const [expandingNode, setExpandingNode] = useState<string | null>(null);
  const [fitViewTrigger, setFitViewTrigger] = useState(0);
  const [freshnessMap, setFreshnessMap] = useState<Record<string, { lastAltered: string; tableType: string }>>({});


  // Sync streamFilter when the direction prop changes (e.g., navigating to a different graph)
  useEffect(() => {
    setStreamFilter((direction || 'BOTH').toLowerCase() as 'upstream' | 'downstream' | 'both');
  }, [direction]);

  const toggleCollapse = useCallback((nodeId: string) => {
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
    setPopupNode(null);
    // Trigger auto-fit after collapse change
    setTimeout(() => setFitViewTrigger((v) => v + 1), 50);
  }, []);

  const exploreFurther = useCallback(async (nodeId: string) => {
    setExpandingNode(nodeId);
    setPopupNode(null);
    try {
      const parts = nodeId.split('.');
      if (parts.length < 3) return;
      const [nodeDb, nodeSchema, ...rest] = parts;
      const nodeObjectName = rest.join('.');

      const params = {
        dbName: nodeDb,
        schemaName: nodeSchema,
        objectName: nodeObjectName,
        objectType: 'TABLE',
        direction: 'BOTH',
        distance: 3,
        includeColumn: 'no',
      };

      const res = await api.get('/lineage', { params });
      const raw = res.data;
      const newNodes = raw.object_lineage?.nodes || [];
      const newEdges = raw.object_lineage?.edges || [];

      setApiData((prev) => {
        if (!prev) return prev;
        const existingNodeIds = new Set(prev.nodes.map((n: any) => n.id));
        const existingEdgeIds = new Set(prev.edges.map((e: any) => e.id));

        const addedNodes = newNodes.filter((n: any) => !existingNodeIds.has(n.id));
        const addedEdges = newEdges.filter((e: any) => !existingEdgeIds.has(e.id));

        if (addedNodes.length === 0 && addedEdges.length === 0) return prev;

        return {
          ...prev,
          nodes: [...prev.nodes, ...addedNodes],
          edges: [...prev.edges, ...addedEdges],
        };
      });
    } catch (err) {
      console.error('Explore further failed:', err);
    } finally {
      setExpandingNode(null);
      setTimeout(() => setFitViewTrigger((v) => v + 1), 100);
    }
  }, []);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    exploreFurther,
    getNodeIds: () => nodes.map((n) => n.id),
  }), [exploreFurther, nodes]);

  const expandAll = useCallback(() => {
    setCollapsedNodes(new Set());
    setPopupNode(null);
    setTimeout(() => setFitViewTrigger((v) => v + 1), 50);
  }, []);

  const collapseAll = useCallback(() => {
    // Collapse all non-root nodes that have neighbors (i.e., nodes with children to hide)
    const directNeighbors = new Set<string>();
    rawEdgesRef.current.forEach((e) => {
      if (e.source === rootFqnRef.current) directNeighbors.add(e.target);
      if (e.target === rootFqnRef.current) directNeighbors.add(e.source);
    });
    // Only collapse direct neighbors that themselves have further connections (not leaf nodes)
    const collapsible = new Set<string>();
    directNeighbors.forEach((nodeId) => {
      const hasFurtherConnections = rawEdgesRef.current.some(
        (e) => (e.source === nodeId || e.target === nodeId) &&
               e.source !== rootFqnRef.current && e.target !== rootFqnRef.current
      );
      if (hasFurtherConnections) collapsible.add(nodeId);
    });
    setCollapsedNodes(collapsible);
    setPopupNode(null);
    setTimeout(() => setFitViewTrigger((v) => v + 1), 50);
  }, []);

  // Fetch data from API
  useEffect(() => {
    if (!db || !schema || !objectName || !objectType) return;
    const abort = new AbortController();
    let cancelled = false;
    async function fetchLineage() {
      setLoading(true);
      setErr(null);
      try {
        const params: Record<string, string | number | undefined> = {
          dbName: db,
          schemaName: schema,
          objectName,
          objectType,
          direction: 'BOTH',
          includeColumn,
          ...(includeColumn === 'yes' && columnName ? { columnName } : {}),
          ...(typeof maxDepth === 'number' ? { distance: maxDepth } : {}),
        };
        const res = await api.get('/lineage', { params, signal: abort.signal as any });
        if (cancelled) return;
        const raw = res.data;
        const includeColumns = raw?.meta?.include_columns === 1;
        const objNodes = raw.object_lineage?.nodes || [];
        const objEdges = raw.object_lineage?.edges || [];
        const colNodes = raw.column_lineage?.nodes || [];
        const colEdgesObj = raw.column_lineage?.edges || {};
        const colEdges = Object.values(colEdgesObj);
        const finalNodes = includeColumns ? colNodes : objNodes;
        const finalEdges = includeColumns ? colEdges : objEdges;
        const data: ApiResponse = {
          nodes: finalNodes,
          edges: finalEdges,
          meta: {
            db: raw.meta?.db,
            schema: raw.meta?.schema,
            objectName: raw.meta?.object,
            objectType: raw.meta?.object_type,
            direction: raw.meta?.direction,
            maxDepth: raw.meta?.max_distance,
          },
        };
        (data as any).__raw_column_nodes = colNodes;
        (data as any).__raw_column_edges = colEdges;
        const types = new Set<string>();
        finalNodes.forEach((n: any) => {
          const t = (n.type || '').toLowerCase();
          if (t.includes('table')) types.add('table');
          else if (t.includes('view')) types.add('view');
          else if (t.includes('column')) types.add('column');
        });
        setLegendItems(types);
        onDataLoaded?.(data);
        setApiData(data);
      } catch (e: any) {
        if (cancelled || e?.code === 'ERR_CANCELED') return;
        const message = e?.message || e?.data?.message || String(e);
        setErr(message);
        setApiData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchLineage();
    return () => {
      cancelled = true;
      abort.abort();
    };
  }, [
    db,
    schema,
    objectType,
    objectName,
    maxDepth,
    includeColumn,
    columnName,
    onDataLoaded,
  ]);

  // Fetch freshness & verified object types for all lineage nodes
  useEffect(() => {
    if (!apiData?.nodes?.length) return;
    const fqns = apiData.nodes
      .map((n: any) => n.id)
      .filter(Boolean);
    if (fqns.length === 0) return;

    let cancelled = false;
    async function fetchFreshness() {
      try {
        const res = await api.get('/lineage/freshness', { params: { objects: fqns.join(',') } });
        if (!cancelled) setFreshnessMap(res.data || {});
      } catch {
        // Non-critical: silently ignore freshness fetch failures
      }
    }
    fetchFreshness();
    return () => { cancelled = true; };
  }, [apiData]);

  // Compute layout with D3 force simulation, then build React Flow nodes/edges
  useEffect(() => {
    if (!apiData || !isPanelOpen || loading) return;
    if (!apiData.nodes?.length) {
      setNodes([]);
      setEdges([]);
      return;
    }

    const rootFqn =
      `${(apiData.meta?.db || db).toUpperCase()}.` +
      `${(apiData.meta?.schema || schema).toUpperCase()}.` +
      `${(apiData.meta?.objectName || objectName).toUpperCase()}`;

    const rawEdges = (apiData.edges || []).map((e) => ({
      ...e,
      source: e.source,
      target: e.target,
    }));

    // Store for use in other effects/handlers
    rawEdgesRef.current = rawEdges;
    rootFqnRef.current = rootFqn;

    // Compute collapse hidden state
    const { hiddenCounts, hiddenSet } = computeCollapseState(collapsedNodes, rawEdges, rootFqn);

    // BFS: classify nodes as upstream or downstream relative to root
    const upstreamNodeIds = new Set<string>();
    const downstreamNodeIds = new Set<string>();

    const upQueue = [rootFqn];
    const upVisited = new Set<string>([rootFqn]);
    while (upQueue.length) {
      const current = upQueue.shift()!;
      rawEdges.forEach((e) => {
        if (e.target === current && !upVisited.has(e.source)) {
          upVisited.add(e.source);
          upstreamNodeIds.add(e.source);
          upQueue.push(e.source);
        }
      });
    }

    const downQueue = [rootFqn];
    const downVisited = new Set<string>([rootFqn]);
    while (downQueue.length) {
      const current = downQueue.shift()!;
      rawEdges.forEach((e) => {
        if (e.source === current && !downVisited.has(e.target)) {
          downVisited.add(e.target);
          downstreamNodeIds.add(e.target);
          downQueue.push(e.target);
        }
      });
    }

    // Store classification in ref for use in stream filter effect
    const classMap = new Map<string, string>();
    classMap.set(rootFqn, 'root');
    upstreamNodeIds.forEach((id) => classMap.set(id, 'upstream'));
    downstreamNodeIds.forEach((id) => classMap.set(id, 'downstream'));
    nodeClassificationRef.current = classMap;

    // Compute horizontal layered layout using BFS depth from root
    const depthMap = new Map<string, number>();
    depthMap.set(rootFqn, 0);

    // BFS to assign depth (layer) to each node
    const bfsQueue = [rootFqn];
    const bfsVisited = new Set<string>([rootFqn]);
    while (bfsQueue.length) {
      const current = bfsQueue.shift()!;
      const currentDepth = depthMap.get(current)!;
      rawEdges.forEach((e) => {
        // Downstream: source -> target (positive depth)
        if (e.source === current && !bfsVisited.has(e.target)) {
          bfsVisited.add(e.target);
          depthMap.set(e.target, currentDepth + 1);
          bfsQueue.push(e.target);
        }
        // Upstream: target -> source (negative depth)
        if (e.target === current && !bfsVisited.has(e.source)) {
          bfsVisited.add(e.source);
          depthMap.set(e.source, currentDepth - 1);
          bfsQueue.push(e.source);
        }
      });
    }

    // Assign any unvisited nodes a depth of 0
    apiData.nodes.forEach((n) => {
      if (!depthMap.has(n.id)) depthMap.set(n.id, 0);
    });

    // Group nodes by depth layer for vertical spacing
    const layerGroups = new Map<number, string[]>();
    depthMap.forEach((depth, id) => {
      if (!layerGroups.has(depth)) layerGroups.set(depth, []);
      layerGroups.get(depth)!.push(id);
    });

    // Compute positions: x based on depth (horizontal), y spread within each layer
    const LAYER_GAP_X = 280;
    const NODE_GAP_Y = 120;
    const positionMap = new Map<string, { x: number; y: number }>();

    // Normalize depths so minimum depth starts at 0
    const allDepths = Array.from(depthMap.values());
    const minDepth = Math.min(...allDepths);

    layerGroups.forEach((nodeIds, depth) => {
      const normalizedX = (depth - minDepth) * LAYER_GAP_X;
      const totalHeight = (nodeIds.length - 1) * NODE_GAP_Y;
      const startY = -totalHeight / 2;
      nodeIds.forEach((id, idx) => {
        positionMap.set(id, { x: normalizedX, y: startY + idx * NODE_GAP_Y });
      });
    });

    // Build a set of node IDs that have connections beyond just the root (i.e., can hide children when collapsed)
    const nodesWithChildren = new Set<string>();
    rawEdges.forEach((e) => {
      // A node has "children" if it connects to something other than root
      if (e.source !== rootFqn && e.target !== rootFqn) {
        nodesWithChildren.add(e.source);
        nodesWithChildren.add(e.target);
      }
      // Also include nodes that are not root but have downstream OR upstream neighbors beyond root
      if (e.source === rootFqn) {
        // target is direct neighbor of root: check if target has further connections
        const hasFurther = rawEdges.some(
          (e2) => (e2.source === e.target || e2.target === e.target) && e2.source !== rootFqn && e2.target !== rootFqn
        );
        if (hasFurther) nodesWithChildren.add(e.target);
      }
      if (e.target === rootFqn) {
        const hasFurther = rawEdges.some(
          (e2) => (e2.source === e.source || e2.target === e.source) && e2.source !== rootFqn && e2.target !== rootFqn
        );
        if (hasFurther) nodesWithChildren.add(e.source);
      }
    });

    const rfNodes: Node[] = apiData.nodes.map((n) => {
      const isRoot = (n.id || '').toUpperCase() === rootFqn;
      const t = (n.type || '').toLowerCase();
      let nodeType: LineageNodeData['nodeType'] = 'default';
      if (n.isExternal || n.domain === 'EXTERNAL') {
        const extType = t || 'external';
        if (extType === 's3' || extType === 'aws_s3') nodeType = 's3';
        else if (extType === 'postgres' || extType === 'postgresql' || extType === 'mysql') nodeType = 'postgres';
        else if (extType === 'kafka') nodeType = 'kafka';
        else if (extType === 'api' || extType === 'rest') nodeType = 'api';
        else if (extType === 'azure_blob' || extType === 'azure') nodeType = 'azure_blob';
        else if (extType === 'gcs') nodeType = 'gcs';
        else nodeType = 'external';
      } else if (n.domain === 'STAGE' || t === 'stage') {
        nodeType = 'stage';
      } else if (t.includes('table')) nodeType = 'table';
      else if (t.includes('view')) nodeType = 'view';
      else if (t.includes('column')) nodeType = 'column';

      // Override nodeType with verified TABLE_TYPE from INFORMATION_SCHEMA if available
      const freshnessEntry = freshnessMap[n.id?.toUpperCase()] || freshnessMap[n.id];
      if (freshnessEntry?.tableType) {
        const verifiedType = freshnessEntry.tableType.toUpperCase();
        if (verifiedType === 'VIEW' || verifiedType === 'MATERIALIZED VIEW') {
          nodeType = 'view';
        } else if (verifiedType === 'BASE TABLE' || verifiedType === 'TABLE' || verifiedType === 'EXTERNAL TABLE') {
          nodeType = 'table';
        }
      }

      const parts = (n.id || '').split('.');
      const label = parts[parts.length - 1] || n.id;

      const pos = positionMap.get(n.id) || { x: 0, y: 0 };

      // Compute freshness status
      const lastAltered = freshnessEntry?.lastAltered || null;
      let freshnessStatus: 'fresh' | 'stale' | 'old' | 'unknown' = 'unknown';
      if (lastAltered) {
        const hoursAgo = (Date.now() - new Date(lastAltered).getTime()) / (1000 * 60 * 60);
        if (hoursAgo <= 24) freshnessStatus = 'fresh';
        else if (hoursAgo <= 168) freshnessStatus = 'stale'; // 7 days
        else freshnessStatus = 'old';
      }

      const classification = isRoot
        ? 'root'
        : upstreamNodeIds.has(n.id)
          ? 'upstream'
          : downstreamNodeIds.has(n.id)
            ? 'downstream'
            : '';

      // Apply stream filter: hide nodes not matching the selected direction
      let hidden = false;
      if (streamFilter === 'upstream' && classification === 'downstream') hidden = true;
      if (streamFilter === 'downstream' && classification === 'upstream') hidden = true;
      if (hiddenSet.has(n.id)) hidden = true;

      return {
        id: n.id,
        type: 'lineage',
        position: pos,
        hidden,
        data: {
          label,
          subtitle: nodeType !== 'default' ? nodeType : (n.type ? n.type.toLowerCase() : ''),
          nodeType,
          isRoot,
          fullId: n.id,
          distance: n.distance,
          status: n.status,
          isCollapsed: collapsedNodes.has(n.id),
          hiddenCount: hiddenCounts.get(n.id) || 0,
          hasNeighbors: nodesWithChildren.has(n.id) && !isRoot,
          isTerminal: !nodesWithChildren.has(n.id) && !isRoot && !n.isExternal,
          freshnessStatus,
          lastAltered,
          isExternal: n.isExternal || false,
          domain: n.domain || null,
          database: n.database || (n.id ? n.id.split('.')[0] : null),
          sourceNamespace: n.sourceNamespace || null,
          sourceName: n.sourceName || null,
          description: n.description || null,
          classification,
          piiCount: piiData?.get(n.id)?.piiCount || piiData?.get(n.id?.toUpperCase())?.piiCount || 0,
          piiStatus: (piiData?.get(n.id)?.piiStatus || piiData?.get(n.id?.toUpperCase())?.piiStatus || 'none') as LineageNodeData['piiStatus'],
        } as LineageNodeData,
      };
    });

    // Build React Flow edges
    const getEdgeColor = (e: any): string => {
      const t = (e.type || '').toLowerCase();
      if (t === 'column') return COLUMN_COLOR;
      if (upstreamNodeIds.has(e.source) || upstreamNodeIds.has(e.target)) return UPSTREAM_COLOR;
      if (downstreamNodeIds.has(e.source) || downstreamNodeIds.has(e.target))
        return DOWNSTREAM_COLOR;
      return '#94a3b8';
    };

    const rfEdges: Edge[] = rawEdges.map((e, idx) => {
      const color = getEdgeColor(e);
      const sourceClass = classMap.get(e.source) || '';
      const targetClass = classMap.get(e.target) || '';
      const hasDownstream = sourceClass === 'downstream' || targetClass === 'downstream';
      const hasUpstream = sourceClass === 'upstream' || targetClass === 'upstream';

      return {
        id: `edge-${idx}-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        style: { stroke: color, strokeWidth: 2 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color,
          width: 16,
          height: 16,
        },
        animated: true,
        hidden:
          hiddenSet.has(e.source) ||
          hiddenSet.has(e.target) ||
          (streamFilter === 'upstream' && hasDownstream) ||
          (streamFilter === 'downstream' && hasUpstream),
      };
    });

    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [apiData, isPanelOpen, loading, db, schema, objectName, streamFilter, setNodes, setEdges, collapsedNodes, freshnessMap, piiData]);

  // Apply search highlighting, stream direction filtering, collapse visibility, and impact highlights
  useEffect(() => {
    const { hiddenSet } = computeCollapseState(collapsedNodes, rawEdgesRef.current, rootFqnRef.current);
    const classMap = nodeClassificationRef.current;

    // Impact severity glow styles
    const IMPACT_GLOW: Record<string, string> = {
      HIGH: '0 0 0 3px #dc2626, 0 0 16px rgba(220, 38, 38, 0.5)',
      MODERATE: '0 0 0 3px #ea580c, 0 0 14px rgba(234, 88, 12, 0.45)',
      WARNING: '0 0 0 3px #ca8a04, 0 0 12px rgba(202, 138, 4, 0.4)',
    };

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        const classification = classMap.get(node.id) || '';

        // Stream filter: hide nodes not matching the selected direction
        let hidden = false;
        if (streamFilter === 'upstream' && classification === 'downstream') hidden = true;
        if (streamFilter === 'downstream' && classification === 'upstream') hidden = true;

        // Collapse filter
        if (hiddenSet.has(node.id)) hidden = true;

        // Search highlight
        const data = node.data as unknown as LineageNodeData;
        const query = searchQuery.trim().toLowerCase();
        const isMatch = query
          ? (data.label?.toLowerCase().includes(query) || data.fullId?.toLowerCase().includes(query))
          : false;

        // Impact highlight (takes priority over search when both active)
        // Use case-insensitive lookup to handle Snowflake case variations
        const nodeIdUpper = node.id.toUpperCase();
        const impactSeverity = highlightedNodes?.get(node.id) || highlightedNodes?.get(nodeIdUpper);
        const impactGlow = impactSeverity ? IMPACT_GLOW[impactSeverity] : undefined;

        // If this is the root node AND it's impacted, combine both glows
        const isRoot = data.isRoot;
        const rootGlow = '0 0 12px rgba(79, 70, 229, 0.4)';
        let combinedShadow: string | undefined;
        if (impactGlow && isRoot) {
          combinedShadow = `${impactGlow}, ${rootGlow}`;
        } else if (impactGlow) {
          combinedShadow = impactGlow;
        } else if (isMatch) {
          combinedShadow = '0 0 0 3px #2563eb, 0 0 16px rgba(37, 99, 235, 0.5)';
        }

        return {
          ...node,
          hidden,
          style: {
            ...node.style,
            boxShadow: combinedShadow,
            borderRadius: (isMatch || impactGlow) ? 10 : undefined,
            opacity: query && !isMatch && !impactGlow ? 0.35 : hidden ? 0 : 1,
            transition: 'opacity 0.3s ease, box-shadow 0.3s ease',
          },
        };
      })
    );
    // Also hide edges connected to hidden nodes
    setEdges((currentEdges) =>
      currentEdges.map((edge) => {
        const sourceClass = classMap.get(edge.source) || '';
        const targetClass = classMap.get(edge.target) || '';
        const hasDownstream = sourceClass === 'downstream' || targetClass === 'downstream';
        const hasUpstream = sourceClass === 'upstream' || targetClass === 'upstream';

        return {
          ...edge,
          hidden:
            hiddenSet.has(edge.source) ||
            hiddenSet.has(edge.target) ||
            (streamFilter === 'upstream' && hasDownstream) ||
            (streamFilter === 'downstream' && hasUpstream),
        };
      })
    );
  }, [searchQuery, streamFilter, collapsedNodes, setNodes, setEdges, highlightedNodes]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    const data = node.data as unknown as LineageNodeData;
    setSelectedNode(node.id);
    if (!data.isExternal) {
      setPopupNode((prev) =>
        prev?.id === node.id ? null : { id: node.id, x: _.clientX, y: _.clientY }
      );
    } else {
      setPopupNode(null);
    }
  }, []);



  const miniMapNodeColor = useCallback((node: Node) => {
    const d = node.data as unknown as LineageNodeData;
    if (d.isRoot) return '#4f46e5';
    if (d.nodeType === 'table') return '#16a34a';
    if (d.nodeType === 'view') return '#666';
    if (d.nodeType === 'column') return '#ff9800';
    if (d.isExternal || d.domain === 'EXTERNAL') return '#e91e63';
    if (d.nodeType === 'stage') return '#3f51b5';
    if (d.nodeType === 's3') return '#ff9800';
    if (d.nodeType === 'postgres') return '#336791';
    if (d.nodeType === 'kafka') return '#231f20';
    if (d.nodeType === 'api') return '#7b1fa2';
    return '#333';
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;

      const key = e.key.toLowerCase();

      if (key === 'escape') {
        setPopupNode(null);
        setSelectedNode(null);
        return;
      }

      if (key === 'f') {
        e.preventDefault();
        setFitViewTrigger((v) => v + 1);
        return;
      }

      if (key === 'e' && selectedNode) {
        // Expand: remove from collapsed set if present
        setCollapsedNodes((prev) => {
          if (prev.has(selectedNode)) {
            const next = new Set(prev);
            next.delete(selectedNode);
            return next;
          }
          return prev;
        });
        setTimeout(() => setFitViewTrigger((v) => v + 1), 50);
        return;
      }

      if (key === 'c' && selectedNode) {
        // Collapse: add to collapsed set only if node has neighbors (children)
        const nodeHasNeighbors = rawEdgesRef.current.some(
          (e) => (e.source === selectedNode || e.target === selectedNode) && selectedNode !== rootFqnRef.current
        );
        if (nodeHasNeighbors) {
          setCollapsedNodes((prev) => {
            if (!prev.has(selectedNode)) {
              const next = new Set(prev);
              next.add(selectedNode);
              return next;
            }
            return prev;
          });
          setTimeout(() => setFitViewTrigger((v) => v + 1), 50);
        }
        return;
      }

      // Arrow key navigation
      if (selectedNode && ['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
        e.preventDefault();
        const currentEdges = rawEdgesRef.current;
        let candidates: string[] = [];

        if (key === 'arrowright') {
          // Navigate to downstream neighbor
          candidates = currentEdges.filter(edge => edge.source === selectedNode).map(edge => edge.target);
        } else if (key === 'arrowleft') {
          // Navigate to upstream neighbor
          candidates = currentEdges.filter(edge => edge.target === selectedNode).map(edge => edge.source);
        } else if (key === 'arrowup' || key === 'arrowdown') {
          // Navigate to sibling (same depth layer)
          const currentNode = nodes.find(n => n.id === selectedNode);
          if (currentNode) {
            const currentY = currentNode.position.y;
            const currentX = currentNode.position.x;
            const siblings = nodes
              .filter(n => Math.abs(n.position.x - currentX) < 10 && n.id !== selectedNode && !n.hidden)
              .sort((a, b) => a.position.y - b.position.y);
            if (key === 'arrowdown') {
              const next = siblings.find(n => n.position.y > currentY);
              if (next) candidates = [next.id];
            } else {
              const prev = [...siblings].reverse().find(n => n.position.y < currentY);
              if (prev) candidates = [prev.id];
            }
          }
        }

        // Select first visible candidate
        const visibleCandidate = candidates.find(id => {
          const n = nodes.find(node => node.id === id);
          return n && !n.hidden;
        });
        if (visibleCandidate) {
          setSelectedNode(visibleCandidate);
        }
      }
    };

    const container = graphContainerRef?.current || document;
    container.addEventListener('keydown', handleKeyDown as EventListener);
    return () => container.removeEventListener('keydown', handleKeyDown as EventListener);
  }, [selectedNode, nodes, graphContainerRef, toggleCollapse]);

  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
      <div
        ref={graphContainerRef}
        tabIndex={0}
        style={{
          height: '80vh',
          border: '1px solid #ddd',
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          outline: 'none',
      }}
    >
      {loading && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            py: 8,
          }}
        >
          <CircularProgress size={40} sx={{ color: "#2563eb", mb: 2 }} />
          <Typography
            variant="body2"
            sx={{  fontWeight: 500, fontSize: "0.9rem" }}
          >
            Loading lineage...
          </Typography>
        </Box>
      )}
      {err && <div style={{ padding: 12, color: 'crimson' }}>Error: {err}</div>}
      {!loading && !err && !apiData?.nodes?.length && (
        <div style={{ padding: 12, color: '#555' }}>No lineage found for the given inputs.</div>
      )}
      {!loading && !err && apiData?.nodes?.length ? (
        <>
          <div
            style={{
              padding: '8px 12px',
              background: '#fff',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
            }}
          >
            {/* Search nodes */}
            <TextField
              size="small"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ fontSize: 18, color: '#2563eb' }} />
                  </InputAdornment>
                ),
              }}
              sx={{
                minWidth: 220,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2,
                  fontSize: '0.8rem',
                  '& fieldset': { borderColor: '#bfdbfe' },
                  '&:hover fieldset': { borderColor: '#2563eb' },
                  '&.Mui-focused fieldset': { borderColor: '#2563eb' },
                },
              }}
            />

            {/* Stream direction toggle */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <ToggleButtonGroup
                value={streamFilter}
                exclusive
                onChange={(_, val) => {
                  if (val) setStreamFilter(val);
                }}
                size="small"
                sx={{
                  '& .MuiToggleButton-root': {
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    px: 1.5,
                    py: 0.5,
                    borderColor: '#bfdbfe',
                    color: '#64748b',
                    '&.Mui-selected': {
                      bgcolor: '#2563eb',
                      color: '#fff',
                      borderColor: '#2563eb',
                      '&:hover': { bgcolor: '#1d4ed8' },
                    },
                    '&:hover': { bgcolor: '#eff6ff' },
                  },
                }}
              >
                <ToggleButton value="upstream">
                  <NorthIcon sx={{ fontSize: 14, mr: 0.5 }} />
                  Upstream
                </ToggleButton>
                <ToggleButton value="both">
                  <SyncAltIcon sx={{ fontSize: 14, mr: 0.5 }} />
                  Both
                </ToggleButton>
                <ToggleButton value="downstream">
                  <SouthIcon sx={{ fontSize: 14, mr: 0.5 }} />
                  Downstream
                </ToggleButton>
              </ToggleButtonGroup>

              <Button
                variant="contained"
                size="small"
                startIcon={<AutoAwesomeOutlinedIcon sx={{ fontSize: 15 }} />}
                onClick={onExplainAI}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  px: 2,
                  py: 0.6,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                  boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)',
                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.35)',
                  },
                }}
              >
                Explain AI
              </Button>

              {/* Expand All / Collapse All */}
              <Tooltip title="Expand all nodes">
                <IconButton size="small" onClick={expandAll} sx={{ color: '#16a34a' }}>
                  <UnfoldMoreIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title="Collapse all nodes">
                <IconButton size="small" onClick={collapseAll} sx={{ color: '#dc2626' }}>
                  <UnfoldLessIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </div>
          <div style={{ position: 'relative', flex: 1, cursor: 'default' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeClick={onNodeClick}
              onPaneClick={() => setPopupNode(null)}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              nodesDraggable
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.3}
              maxZoom={4}
            >
              <Controls />
              <Background gap={20} size={1} color="#f0f0f0" />
              <MiniMap nodeColor={miniMapNodeColor} nodeStrokeWidth={2} zoomable pannable />
              <AutoFitOnChange trigger={fitViewTrigger} />
            </ReactFlow>
            {/* Node action popup */}
            {popupNode && (
              <div
                style={{
                  position: 'fixed',
                  left: popupNode.x + 10,
                  top: popupNode.y - 20,
                  background: '#fff',
                  borderRadius: 8,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
                  border: '1px solid #e2e8f0',
                  padding: '6px 0',
                  zIndex: 10000,
                  minWidth: 140,
                  animation: 'fadeIn 0.2s ease',
                }}
              >
                <div
                  style={{
                    padding: '4px 14px',
                    fontSize: 11,
                    color: '#64748b',
                    fontWeight: 600,
                    borderBottom: '1px solid #f1f5f9',
                    marginBottom: 2,
                  }}
                >
                  {nodes.find((n) => n.id === popupNode.id)?.data
                    ? (nodes.find((n) => n.id === popupNode.id)!.data as unknown as LineageNodeData).label
                    : ''}
                </div>
                {collapsedNodes.has(popupNode.id) ? (
                  <div
                    onClick={() => toggleCollapse(popupNode.id)}
                    style={{
                      padding: '8px 14px',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 500,
                      color: '#16a34a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f0fdf4'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <UnfoldMoreIcon sx={{ fontSize: 16 }} /> Expand
                  </div>
                ) : (
                  <div
                    onClick={() => toggleCollapse(popupNode.id)}
                    style={{
                      padding: '8px 14px',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 500,
                      color: '#dc2626',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fef2f2'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <UnfoldLessIcon sx={{ fontSize: 16 }} /> Collapse
                  </div>
                )}
                <div
                  onClick={() => exploreFurther(popupNode.id)}
                  style={{
                    padding: '8px 14px',
                    cursor: expandingNode === popupNode.id ? 'wait' : 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#059669',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'background 0.15s',
                    opacity: expandingNode === popupNode.id ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#ecfdf5'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <AccountTreeIcon sx={{ fontSize: 16 }} /> {expandingNode === popupNode.id ? 'Loading...' : 'Explore Further'}
                </div>
                <div
                  onClick={() => {
                    const nodeData = nodes.find((n) => n.id === popupNode.id)?.data as unknown as LineageNodeData | undefined;
                    if (nodeData && onNodeDetails) {
                      onNodeDetails(popupNode.id, nodeData);
                    }
                    setPopupNode(null);
                  }}
                  style={{
                    padding: '8px 14px',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#2563eb',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#eff6ff'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <InfoOutlinedIcon sx={{ fontSize: 16 }} /> Node Details
                </div>
                <div
                  onClick={() => {
                    const nodeData = nodes.find((n) => n.id === popupNode.id)?.data as unknown as LineageNodeData | undefined;
                    if (nodeData && onExplainAI) {
                      onExplainAI(popupNode.id, nodeData);
                    }
                    setPopupNode(null);
                  }}
                  style={{
                    padding: '8px 14px',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#7c3aed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f5f3ff'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <AutoAwesomeOutlinedIcon sx={{ fontSize: 16 }} /> Chat with AI
                </div>
                {onImpactAnalysis && (
                <div
                  onClick={() => {
                    const nodeData = nodes.find((n) => n.id === popupNode.id)?.data as unknown as LineageNodeData | undefined;
                    if (nodeData) {
                      onImpactAnalysis(popupNode.id, nodeData);
                    }
                    setPopupNode(null);
                  }}
                  style={{
                    padding: '8px 14px',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#dc2626',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fef2f2'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <BoltIcon sx={{ fontSize: 16 }} /> Analyze Impact
                </div>
                )}
                {onScanPII && (
                <div
                  onClick={() => {
                    const nodeData = nodes.find((n) => n.id === popupNode.id)?.data as unknown as LineageNodeData | undefined;
                    if (nodeData) {
                      onScanPII(popupNode.id, nodeData);
                    }
                    setPopupNode(null);
                  }}
                  style={{
                    padding: '8px 14px',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                    color: '#7c3aed',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f5f3ff'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <ShieldOutlinedIcon sx={{ fontSize: 16 }} /> Scan for PII
                </div>
                )}
              </div>
            )}
          </div>
          {/* Legend */}
          <div
            style={{
              padding: '12px 14px',
              background: '#f8f9fa',
              borderTop: '1px solid #ddd',
              display: 'flex',
              alignItems: 'center',
              gap: 20,
              fontSize: 12,
              flexWrap: 'wrap',
            }}
          >
            {/* Table node */}
            {legendItems.has('table') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="28" height="20" style={{ minWidth: 28 }}>
                  <rect
                    x="2"
                    y="2"
                    width="24"
                    height="16"
                    rx="4"
                    fill="#e8f5e9"
                    stroke="#16a34a"
                    strokeWidth="2"
                  />
                </svg>
                <span>Table</span>
              </div>
            )}
            {/* View node */}
            {legendItems.has('view') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="28" height="20" style={{ minWidth: 28 }}>
                  <rect
                    x="2"
                    y="2"
                    width="24"
                    height="16"
                    rx="4"
                    fill="#ffffff"
                    stroke="#666"
                    strokeWidth="2"
                    strokeDasharray="3,2"
                  />
                </svg>
                <span>View</span>
              </div>
            )}
            {/* Root node */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="28" height="20" style={{ minWidth: 28 }}>
                <rect
                  x="2"
                  y="2"
                  width="24"
                  height="16"
                  rx="4"
                  fill="#e3f2fd"
                  stroke="#4f46e5"
                  strokeWidth="3"
                />
              </svg>
              <span>Root</span>
            </div>
            {/* Upstream edge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="28" height="12" style={{ minWidth: 28 }}>
                <line x1="2" y1="6" x2="22" y2="6" stroke="#ef4444" strokeWidth="3" />
                <polygon points="20,2 26,6 20,10" fill="#ef4444" />
              </svg>
              <span>Upstream</span>
            </div>
            {/* Downstream edge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="28" height="12" style={{ minWidth: 28 }}>
                <line x1="2" y1="6" x2="22" y2="6" stroke="#06b6d4" strokeWidth="3" />
                <polygon points="20,2 26,6 20,10" fill="#06b6d4" />
              </svg>
              <span>Downstream</span>
            </div>
            {/* Column node */}
            {legendItems.has('column') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="28" height="20" style={{ minWidth: 28 }}>
                  <rect
                    x="2"
                    y="2"
                    width="24"
                    height="16"
                    rx="4"
                    fill="#fff3cd"
                    stroke="#ff9800"
                    strokeWidth="2"
                  />
                </svg>
                <span>Column</span>
              </div>
            )}
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: '#2563eb', fontWeight: 600 }}>
                Nodes: {nodes.filter((n) => !n.hidden).length}&nbsp;&nbsp;Edges: {edges.filter((e) => !e.hidden).length}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginLeft: 'auto',
                color: '#666',
              }}
            >
              <span>Scroll to zoom · Drag to pan · Click nodes for details · <strong>E</strong>xpand · <strong>C</strong>ollapse · <strong>F</strong>it · <strong>Esc</strong> deselect · Arrows navigate</span>
            </div>
          </div>
        </>
      ) : null}
      </div>

    </>
  );
});

export default LineageGraph;
