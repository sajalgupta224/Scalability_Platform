/**
 * Citation Types
 * Consolidated from TalkToDocument, PipelinePanel, and DocumentSection
 */

/**
 * Citation entry with citations data
 * (Your UI does not consume the inner structure today; keys are sufficient.)
 */
export type CitationEntry = {
  citations: any;
};

/**
 * Map of citations keyed by document name
 * Example:
 * {
 *   "Banking.pdf": { citations: {} },
 *   "FD_Rates.pdf": { citations: {} }
 * }
 */
export type CitationsMap = Record<string, CitationEntry>;