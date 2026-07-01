import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface LineageNodeData {
  label: string;
  subtitle: string;
  nodeType: "table" | "view" | "column" | "root" | "default" | "stage" | "external" | "s3" | "postgres" | "kafka" | "api" | "azure_blob" | "gcs";
  isRoot: boolean;
  fullId: string;
  isCollapsed?: boolean;
  hiddenCount?: number;
  hasNeighbors?: boolean;
  freshnessStatus?: "fresh" | "stale" | "old" | "unknown";
  lastAltered?: string;
  isExternal?: boolean;
  domain?: string;
  database?: string;
  sourceNamespace?: string;
  sourceName?: string;
  description?: string;
  isTerminal?: boolean;
  piiCount?: number;
  piiStatus?: 'unprotected' | 'partial' | 'masked' | 'none';
  [key: string]: unknown;
}

const NODE_STYLES: Record<
  string,
  { background: string; border: string; borderStyle: string; color: string }
> = {
  root: {
    background: "#e3f2fd",
    border: "3px solid #4f46e5",
    borderStyle: "solid",
    color: "#1f1f1f",
  },
  table: {
    background: "#e8f5e9",
    border: "2px solid #16a34a",
    borderStyle: "solid",
    color: "#1f1f1f",
  },
  view: {
    background: "#ffffff",
    border: "2px dashed #666",
    borderStyle: "dashed",
    color: "#1f1f1f",
  },
  column: {
    background: "#fff3cd",
    border: "2px solid #ff9800",
    borderStyle: "solid",
    color: "#1f1f1f",
  },
  default: {
    background: "#ffffff",
    border: "2px solid #333",
    borderStyle: "solid",
    color: "#1f1f1f",
  },
  external: {
    background: "#fce4ec",
    border: "2px solid #e91e63",
    borderStyle: "dashed",
    color: "#1f1f1f",
  },
  stage: {
    background: "#e8eaf6",
    border: "2px solid #3f51b5",
    borderStyle: "solid",
    color: "#1f1f1f",
  },
  s3: {
    background: "#fff3e0",
    border: "2px solid #ff9800",
    borderStyle: "solid",
    color: "#1f1f1f",
  },
  postgres: {
    background: "#e3f2fd",
    border: "2px solid #336791",
    borderStyle: "solid",
    color: "#1f1f1f",
  },
  kafka: {
    background: "#e8f5e9",
    border: "2px solid #231f20",
    borderStyle: "solid",
    color: "#1f1f1f",
  },
  api: {
    background: "#f3e5f5",
    border: "2px solid #7b1fa2",
    borderStyle: "solid",
    color: "#1f1f1f",
  },
  azure_blob: {
    background: "#e1f5fe",
    border: "2px solid #0078d4",
    borderStyle: "solid",
    color: "#1f1f1f",
  },
  gcs: {
    background: "#e8f5e9",
    border: "2px solid #4285f4",
    borderStyle: "solid",
    color: "#1f1f1f",
  },
};

const FRESHNESS_COLORS: Record<string, string> = {
  fresh: "#16a34a",
  stale: "#f59e0b",
  old: "#ef4444",
  unknown: "#9ca3af",
};

const FRESHNESS_LABELS: Record<string, string> = {
  fresh: "Fresh (< 24h)",
  stale: "Stale (1-7 days)",
  old: "Old (> 7 days)",
  unknown: "No data",
};

function LineageNode({ data }: NodeProps) {
  const nodeData = data as unknown as LineageNodeData;
  const getStyleKey = () => {
    if (nodeData.isRoot) return "root";
    if (nodeData.isExternal || nodeData.domain === "EXTERNAL") {
      const extType = (nodeData.nodeType || "external").toLowerCase();
      if (extType === "s3" || extType === "aws_s3") return "s3";
      if (extType === "postgres" || extType === "postgresql" || extType === "mysql") return "postgres";
      if (extType === "kafka") return "kafka";
      if (extType === "api" || extType === "rest") return "api";
      if (extType === "azure_blob" || extType === "azure") return "azure_blob";
      if (extType === "gcs" || extType === "google_cloud_storage") return "gcs";
      return "external";
    }
    if (nodeData.nodeType === "stage" || nodeData.domain === "STAGE") return "stage";
    return nodeData.nodeType;
  };
  const styleKey = getStyleKey();
  const styles = NODE_STYLES[styleKey] || NODE_STYLES.default;
  const isCollapsed = nodeData.isCollapsed;
  const hasChildren = nodeData.hasNeighbors;
  const isCollapsedWithChildren = isCollapsed && hasChildren;
  const freshnessStatus = nodeData.freshnessStatus || "unknown";

  return (
    <div
      style={{
        padding: "10px 16px",
        borderRadius: 8,
        background: isCollapsedWithChildren ? "#fef3c7" : styles.background,
        border: isCollapsedWithChildren
          ? `2px ${styles.borderStyle} #f59e0b`
          : styles.border,
        borderStyle: styles.borderStyle,
        minWidth: 120,
        textAlign: "center",
        boxShadow: nodeData.isRoot
          ? "0 0 12px rgba(79, 70, 229, 0.4)"
          : isCollapsedWithChildren
            ? "0 0 8px rgba(245, 158, 11, 0.4)"
            : "0 2px 6px rgba(0,0,0,0.1)",
        cursor: "pointer",
        position: "relative",
        transition: "background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "#555", width: 8, height: 8 }}
      />
      <div
        style={{
          fontWeight: 600,
          fontSize: 12,
          color: styles.color,
          wordBreak: "break-word",
        }}
      >
        {nodeData.label}
      </div>
      {nodeData.subtitle && (
        <div style={{ fontSize: 10, color: "#555", marginTop: 2, opacity: 0.7 }}>
          {nodeData.subtitle}
        </div>
      )}
      {nodeData.isExternal && (
        <div style={{ fontSize: 9, color: "#e91e63", fontWeight: 600, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.5px" }}>
          {(nodeData.nodeType || "EXTERNAL").toUpperCase()}
        </div>
      )}
      {nodeData.domain === "STAGE" && !nodeData.isExternal && (
        <div style={{ fontSize: 9, color: "#3f51b5", fontWeight: 600, marginTop: 2 }}>
          STAGE
        </div>
      )}
      {nodeData.database && !nodeData.isRoot && !nodeData.isExternal && (
        <div style={{ fontSize: 8, color: "#666", marginTop: 1, opacity: 0.8 }}>
          {nodeData.database}
        </div>
      )}
      {/* Hidden count badge - only shown when node has children */}
      {isCollapsedWithChildren && nodeData.hiddenCount != null && nodeData.hiddenCount > 0 && (
        <div
          style={{
            position: "absolute",
            top: -10,
            right: -10,
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            background: "#ef4444",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 700,
            padding: "0 5px",
            boxShadow: "0 2px 6px rgba(239, 68, 68, 0.4)",
            zIndex: 10,
          }}
        >
          +{nodeData.hiddenCount}
        </div>
      )}
      {/* Freshness indicator dot — only for tables and views */}
      {(nodeData.nodeType === 'table' || nodeData.nodeType === 'view') && (
        <div
          title={`${FRESHNESS_LABELS[freshnessStatus]}${nodeData.lastAltered ? ` (${new Date(nodeData.lastAltered).toLocaleDateString()})` : ""}`}
          style={{
            position: "absolute",
            bottom: -4,
            left: -4,
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: FRESHNESS_COLORS[freshnessStatus],
            border: "2px solid #fff",
            boxShadow: `0 0 4px ${FRESHNESS_COLORS[freshnessStatus]}`,
            zIndex: 10,
          }}
        />
      )}
      {nodeData.isTerminal && !nodeData.isExternal && (
        <div
          title="Click to explore further lineage"
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            width: 16,
            height: 16,
            borderRadius: "50%",
            background: "#059669",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 10,
            fontWeight: 700,
            boxShadow: "0 2px 4px rgba(5, 150, 105, 0.4)",
            zIndex: 10,
          }}
        >
          +
        </div>
      )}
      {/* PII Shield Badge */}
      {nodeData.piiCount != null && nodeData.piiCount > 0 && (
        <div
          title={`${nodeData.piiCount} PII column${nodeData.piiCount > 1 ? 's' : ''} (${nodeData.piiStatus})`}
          style={{
            position: "absolute",
            bottom: -6,
            right: -6,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: nodeData.piiStatus === 'unprotected' ? '#dc2626'
              : nodeData.piiStatus === 'partial' ? '#f59e0b'
              : '#16a34a',
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 9,
            fontWeight: 700,
            boxShadow: `0 2px 4px ${nodeData.piiStatus === 'unprotected' ? 'rgba(220,38,38,0.5)' : nodeData.piiStatus === 'partial' ? 'rgba(245,158,11,0.5)' : 'rgba(22,163,98,0.5)'}`,
            zIndex: 10,
            border: "2px solid #fff",
          }}
        >
          ⚠
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: "#555", width: 8, height: 8 }}
      />
    </div>
  );
}

export default memo(LineageNode);
