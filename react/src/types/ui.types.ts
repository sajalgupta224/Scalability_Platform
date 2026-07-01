/**
 * Common UI Component Types
 * Consolidated dropdown and other shared UI element types
 */

/**
 * Generic dropdown option
 * Used in select boxes, filters, and other selection components
 */
export interface DropdownOption {
  label: string;
  value: string;
}

/**
 * Date range selection
 */
export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Document metadata used by the Referred Documents panel
 * - `name` is displayed
 * - `relativePath` (optional) enables download by path if name is unavailable
 * - `url` can be left as '' if not used by your UI (kept for backward compat)
 */
export interface Document {
  name: string;
  url: string;
  pages?: number;
  relativePath?: string;
}