// src/constants/models.ts
export const MAX_SELECTED_MODELS = 3;

export const MODEL_ID_TO_LABEL: Record<string, string> = {
  'claude-4-sonnet': 'Claude Sonnet 4',
  'claude-3-7-sonnet': 'Claude Sonnet 3.7',
  'claude-3-5-sonnet': 'Claude Sonnet 3.5',
};

// ✅ Compatibility export: prevents old imports from crashing
// Do not use this to populate dropdown.
export const models: string[] = [];
``