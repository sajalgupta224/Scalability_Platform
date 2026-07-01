
import React, { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Box,
  Button,
  Checkbox,
  CircularProgress,
  IconButton,
  TextField,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import styles from '../../PolicyScanner.module.scss';

const ROW_HEIGHT = 60;
const VIRTUALIZATION_THRESHOLD = 20;
const TABLE_MAX_HEIGHT = '70vh';
const OVERSCAN_COUNT = 10;

export type ColumnType =
  | 'checkbox'
  | 'text'
  | 'comment'
  | 'approval'
  | 'action'
  | 'status'
  | 'custom';

export interface ColumnConfig {
  key: string;
  header: string;
  type: ColumnType;
  width?: string;
  className?: string;
  render?: (value: any, row: any, onChange?: (value: string) => void) => React.ReactNode;
  editable?: boolean;
  placeholder?: string;
}

export interface ActionButton {
  label: string;
  onClick: () => void;
  variant?: 'contained' | 'outlined';
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}

export interface PolicyScannerTableProps {
  title: string;
  subtitle: string;
  complianceReviewName: string;
  columns: ColumnConfig[];
  data: any[];
  showCheckbox?: boolean;
  actionButtons?: ActionButton[];
  onCheckboxChange?: (id: number | string) => void;
  onSelectAll?: (selectAll: boolean) => void;
  onCommentChange?: (id: number | string, field: string, value: string) => void;
  onRowAction?: (id: number | string, action: string) => void;
  disableRowActions?: boolean;
  isStepLoading?: boolean;
  loadingMessage?: string;
}

/**
 * Helper: camelCase -> SNAKE_CASE
 * ex: articleDisplay -> ARTICLE_DISPLAY
 */
const toSnakeUpper = (key: string) =>
  key.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase();

/**
 * Backend alias mapping (based on your payload keys)
 * This allows table to render even if page didn’t map keys.
 */
const BACKEND_ALIASES: Record<string, string[]> = {
  policyId: ['POLICY_ID'],
  policyDescription: ['POLICY_TEXT'],
  policyType: ['POLICY_TYPE'],
  citations: ['CITATION_DOC'],
  articleDisplay: ['ARTICLEDISPLAY', 'ARTICLE_DISPLAY'],
  complianceDataRequirement: ['COMPLIANCE_DATA_REQUIREMENT'],
  approvalStatus: ['APPROVAL_STATUS'],
};

/**
 * Get cell value using:
 * 1) UI key
 * 2) known backend aliases
 * 3) UPPERCASE key
 * 4) SNAKE_CASE UPPER key
 */
const getCellValue = (row: any, key: string) => {
  if (!row) return undefined;

  // 1) direct UI key
  if (row[key] !== undefined) return row[key];

  // 2) backend alias keys
  const aliases = BACKEND_ALIASES[key] || [];
  for (const a of aliases) {
    if (row[a] !== undefined) return row[a];
  }

  // 3) UPPERCASE fallback (articleDisplay -> ARTICLEDISPLAY)
  const upper = key.toUpperCase();
  if (row[upper] !== undefined) return row[upper];

  // 4) snake-case uppercase fallback (policyId -> POLICY_ID)
  const snakeUpper = toSnakeUpper(key);
  if (row[snakeUpper] !== undefined) return row[snakeUpper];

  return undefined;
};

const PolicyScannerTable: React.FC<PolicyScannerTableProps> = ({
  title,
  subtitle,
  complianceReviewName,
  columns,
  data,
  showCheckbox = false,
  actionButtons = [],
  onCheckboxChange,
  onSelectAll,
  onCommentChange,
  onRowAction,
  disableRowActions = false,
  isStepLoading = false,
  loadingMessage = 'Updating policies...',
}) => {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const shouldVirtualize = data.length > VIRTUALIZATION_THRESHOLD;

  const rowVirtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN_COUNT,
  });

  const allSelected = useMemo(() => data.length > 0 && data.every((row) => row.selected), [data]);
  const someSelected = useMemo(
    () => data.some((row) => row.selected) && !allSelected,
    [data, allSelected]
  );

  const renderCell = (column: ColumnConfig, row: any) => {
    const value = getCellValue(row, column.key);

    // combine className consistently
    const tdClassName = column.className || styles.descriptionCell;

    switch (column.type) {
      case 'checkbox':
        return (
          <td className={styles.checkboxCell} key={column.key}>
            <Checkbox
              checked={row.selected || false}
              onChange={() => onCheckboxChange?.(row.id)}
              sx={{
                color: '#d0d0d0',
                '&.Mui-checked': { color: '#1976d2' },
              }}
            />
          </td>
        );

      case 'comment':
        return (
          <td className={`${styles.commentsCell} ${column.className || ''}`} key={column.key}>
            <TextField
              fullWidth
              placeholder={column.placeholder || 'Add comments...'}
              value={value || ''}
              onChange={(e) => onCommentChange?.(row.id, column.key, e.target.value)}
              variant="outlined"
              className={styles.commentInput}
              disabled={!column.editable}
            />
          </td>
        );

      case 'approval':
        return (
          <td className={`${styles.approvalCell} ${column.className || ''}`} key={column.key}>
            {value && (
              <Box className={styles.approvalStatus}>
                {['Approved', 'approved', 'APPROVED'].includes(value) && (
                  <CheckCircleIcon className={styles.approvalIcon} />
                )}
                <span className={styles.approvalText}>{value}</span>
              </Box>
            )}
          </td>
        );

      case 'status':
        return (
          <td
            className={
              value === 'Success'
                ? styles.successCell
                : value === 'Failed'
                  ? styles.failedCell
                  : tdClassName
            }
            key={column.key}
          >
            {value}
          </td>
        );

      case 'action':
        return (
          <td className={`${styles.actionCell} ${column.className || ''}`} key={column.key}>
            <IconButton
              onClick={() => onRowAction?.(row.id, 'edit')}
              size="small"
              className={styles.editButton}
              disabled={disableRowActions}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </td>
        );

      case 'custom':
        return (
          <td className={tdClassName} key={column.key}>
            {column.render
              ? column.render(value, row, (val) => onCommentChange?.(row.id, column.key, val))
              : value}
          </td>
        );

      case 'text':
      default:
        return (
          <td className={tdClassName} key={column.key}>
            {value}
          </td>
        );
    }
  };

  return (
    <>
      <Box className={styles.headerSection}>
        <Typography variant="h4" className={styles.title}>
          {title}
        </Typography>
        <Typography className={styles.subtitle}>{subtitle}</Typography>
      </Box>

      <Box className={styles.tableSection}>
        {isStepLoading && (
          <Box className={styles.tableLoadingOverlay}>
            <Box className={styles.tableLoadingContent}>
              <CircularProgress />
              <Typography className={styles.tableLoadingMessage}>{loadingMessage}</Typography>
            </Box>
          </Box>
        )}

        <Box className={styles.tableTitle}>
          <Typography className={styles.tableTitleText}>Compliance review:</Typography>
          <Typography className={styles.tableTitleComplianceName}>{complianceReviewName}</Typography>
        </Box>

        <Box
          ref={tableContainerRef}
          className={styles.tableWrapper}
          sx={shouldVirtualize ? { maxHeight: TABLE_MAX_HEIGHT, overflow: 'auto' } : {}}
        >
          <table className={styles.table}>
            <thead>
              <tr>
                {showCheckbox && (
                  <th className={styles.checkboxColumn}>
                    <Checkbox
                      checked={allSelected}
                      indeterminate={someSelected}
                      onChange={() => onSelectAll?.(!allSelected)}
                      sx={{
                        color: '#d0d0d0',
                        '&.Mui-checked': { color: '#1976d2' },
                        '&.MuiCheckbox-indeterminate': { color: '#1976d2' },
                      }}
                    />
                  </th>
                )}

                {columns.map((column) => (
                  <th key={column.key} className={column.className}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {shouldVirtualize ? (
                <>
                  {/* TOP SPACER */}
                  {rowVirtualizer.getVirtualItems().length > 0 &&
                    (rowVirtualizer.getVirtualItems()[0]?.start || 0) > 0 && (
                      <tr key="top-spacer" style={{ height: rowVirtualizer.getVirtualItems()[0]?.start }}>
                        <td colSpan={columns.length + (showCheckbox ? 1 : 0)} />
                      </tr>
                    )}

                  {/* VIRTUAL ROWS */}
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const row = data[virtualRow.index];
                    return (
                      <tr
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        className={row.selected ? styles.selectedRow : ''}
                        style={{ height: `${virtualRow.size}px` }}
                      >
                        {showCheckbox && (
                          <td className={styles.checkboxCell}>
                            <Checkbox
                              checked={row.selected || false}
                              onChange={() => onCheckboxChange?.(row.id)}
                              sx={{
                                color: '#d0d0d0',
                                '&.Mui-checked': { color: '#1976d2' },
                              }}
                            />
                          </td>
                        )}
                        {columns.map((column) => renderCell(column, row))}
                      </tr>
                    );
                  })}

                  {/* BOTTOM SPACER */}
                  {rowVirtualizer.getVirtualItems().length > 0 && (
                    <tr
                      key="bottom-spacer"
                      style={{
                        height:
                          rowVirtualizer.getTotalSize() -
                          (rowVirtualizer.getVirtualItems().at(-1)?.end || 0),
                      }}
                    >
                      <td colSpan={columns.length + (showCheckbox ? 1 : 0)} />
                    </tr>
                  )}
                </>
              ) : (
                data.map((row, index) => (
                  <tr key={`${row.id}-${index}`} className={row.selected ? styles.selectedRow : ''}>
                    {showCheckbox && (
                      <td className={styles.checkboxCell}>
                        <Checkbox
                          checked={row.selected || false}
                          onChange={() => onCheckboxChange?.(row.id)}
                          sx={{
                            color: '#d0d0d0',
                            '&.Mui-checked': { color: '#1976d2' },
                          }}
                        />
                      </td>
                    )}
                    {columns.map((column) => renderCell(column, row))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Box>

        {actionButtons.length > 0 && (
          <Box className={styles.actionButtonsTop}>
            {actionButtons.map((button, index) => (
              <Button
                key={index}
                variant={button.variant || 'contained'}
                onClick={button.onClick}
                startIcon={button.loading ? <CircularProgress size={16} /> : button.icon}
                className={button.className}
                disabled={button.disabled}
              >
                {button.label}
              </Button>
            ))}
          </Box>
        )}
      </Box>
    </>
  );
};

export default PolicyScannerTable;
