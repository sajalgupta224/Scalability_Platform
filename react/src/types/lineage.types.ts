
// src/types/lineage.types.ts
export interface LineageNode {
  id: string;
  type: string;
  distance: number;
}

export interface LineageEdge {
  source: string;
  target: string;
}

export interface LineageMeta {
  db?: string;
  schema?: string;
  objectName?: string;
  objectType?: string;
  direction?: string;
  maxDepth?: number;
  [key: string]: any;
}

export interface LineageResponse {
  nodes: LineageNode[];
  edges: LineageEdge[];
  meta?: LineageMeta;
}

