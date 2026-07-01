// src/pages/LineageGraph/lineageStorage.ts

export type Direction = "UPSTREAM" | "DOWNSTREAM" | "BOTH";

export type ObjectType =
  | "TABLE"
  | "VIEW"
  | "COLUMN"
  ;

export interface LineageGraphConfig {
  id: string;
  graphName: string;
  db: string;
  schema: string;
  objectType: ObjectType;
  objectName: string;
  direction: Direction;
  maxDepth?: number;
  includeColumn: "yes" | "no";
  columnName?: string;
  createdAt: string;
}

const STORAGE_KEY = "lineage_graph_configs_v2";

export function loadAllGraphs(): LineageGraphConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((g: any) => ({
      id: g.id,
      graphName: g.graphName,
      db: g.db,
      schema: g.schema,
      objectType: g.objectType,
      objectName: g.objectName,
      direction: g.direction,
      maxDepth: g.maxDepth ?? undefined,
      includeColumn: g.includeColumn ?? "no",
      columnName: g.columnName ?? undefined,
      createdAt: g.createdAt,
    }));
  } catch {
    return [];
  }
}

export function saveAllGraphs(graphs: LineageGraphConfig[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(graphs));
}

export function addGraph(config: LineageGraphConfig) {
  const graphs = loadAllGraphs();
  graphs.unshift(config);
  saveAllGraphs(graphs);
}

export function getGraphById(id: string): LineageGraphConfig | null {
  return loadAllGraphs().find((g) => g.id === id) || null;
}

export function deleteGraphById(id: string) {
  const filtered = loadAllGraphs().filter((g) => g.id !== id);
  saveAllGraphs(filtered);
}