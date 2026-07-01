import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import { useNotification } from '../../../../hooks/useNotification';
import PolicyScannerTable, {
  type ActionButton,
  type ColumnConfig,
} from '../PolicyScannerTable/PolicyScannerTable';
import EditSQLDialog from '../EditSQLDialog/EditSQLDialog';
import { ComplianceCheckAPI } from '../../../../api/endpoints/policyScanner.api';
import type { PolicyItem } from '../../../../types/policyScanner.types';
import styles from '../../PolicyScanner.module.scss';

interface ComplianceCheckPageProps {
  complianceId: string;
  complianceName: string;
  onLoadingChange?: (loading: boolean) => void;
}

const ComplianceCheckPage: React.FC<ComplianceCheckPageProps> = ({
  complianceId,
  complianceName,
  onLoadingChange,
}) => {
  // Local state
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  // Approval/regenerate flow removed from this page — keep state vars commented for future use
  // const [isApproving, setIsApproving] = useState<boolean>(false);
  // const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState<boolean>(false);

  // Notification
  const { showNotification } = useNotification();

  // Edit SQL Dialog state
  const [isEditSQLDialogOpen, setIsEditSQLDialogOpen] = useState<boolean>(false);
  const [editingPolicyId, setEditingPolicyId] = useState<number | string | null>(null);

  // Computed values
  const hasSelectedRows = useMemo(() => policies.some((policy) => policy.selected), [policies]);

  const editingPolicy = useMemo(
    () => policies.find((p) => p.id === editingPolicyId),
    [policies, editingPolicyId]
  );

  // Notify parent of loading state changes
  useEffect(() => {
    onLoadingChange?.(isLoading || isSaving || isGeneratingReport);
  }, [isLoading, isSaving, isGeneratingReport, onLoadingChange]);

  // Fetch policies on mount
  useEffect(() => {
    const fetchPolicies = async () => {
      if (!complianceId) {
        return;
      }

      setIsLoading(true);
      try {
        const response = await ComplianceCheckAPI.getPolicies(complianceId);
        if (response.success) {
          setPolicies(response.policies);
        } else {
          console.error('Failed to fetch policies:', response.message);
        }
      } catch (error) {
        console.error('Error fetching policies:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPolicies();
  }, [complianceId]);

  // Handlers
  const handleCheckboxChange = useCallback((id: number | string) => {
    setPolicies((prev) =>
      prev.map((policy) => (policy.id === id ? { ...policy, selected: !policy.selected } : policy))
    );
  }, []);

  const handleSelectAll = useCallback((selectAll: boolean) => {
    setPolicies((prev) => prev.map((policy) => ({ ...policy, selected: selectAll })));
  }, []);

  const handleCommentChange = useCallback((id: number | string, field: string, value: string) => {
    if (field === 'commentsOnSQL') {
      setPolicies((prev) =>
        prev.map((policy) => (policy.id === id ? { ...policy, commentsOnSQL: value } : policy))
      );
    }
  }, []);

  const clearSelections = useCallback(() => {
    setPolicies((prev) => prev.map((policy) => ({ ...policy, selected: false })));
  }, []);

  const handleGenerateReport = useCallback(async () => {
    const selectedPolicies = policies.filter((p) => p.selected);

    if (selectedPolicies.length === 0) {
      console.log('No policies selected');
      return;
    }

    setIsGeneratingReport(true);
    try {
      ComplianceCheckAPI.generateReport({
        complianceId,
        policyId: selectedPolicies.map((p) => p.policyId).join(','),
      } as any).catch((e) => console.warn('run-compliance call failed:', e));

      // Build CSV from selected policies
      const columns = [
        'Policy ID',
        'Policy Description',
        'Generated SQL',
        'Comments On SQL',
        'Target Table',
        'Target Column',
      ];

      const escapeCell = (v: any) => {
        if (v === null || v === undefined) return '';
        const s = String(v);
        // If contains comma, newline or quote, wrap in quotes and escape quotes
        if (/[,\n\"]/.test(s)) {
          return `"${s.replace(/"/g, '""')}"`;
        }
        return s;
      };

      const rows = selectedPolicies.map((p) => [
        p.policyId,
        p.policyDescription ?? '',
        p.generatedSQL ?? '',
        p.commentsOnSQL ?? '',
        p.targetTable ?? '',
        p.targetTableColumns ?? '',
      ]);

      const csvContent = [columns, ...rows].map((r) => r.map(escapeCell).join(',')).join('\r\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const filename = `compliance-report-${complianceId}.csv`;

      if ((navigator as any).msSaveBlob) {
        // IE 10+
        (navigator as any).msSaveBlob(blob, filename);
      } else {
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      }

      showNotification({ type: 'success', message: 'Report downloaded' });
      clearSelections();
    } catch (error) {
      console.error('Error generating report:', error);
      showNotification({ type: 'error', message: 'Error generating report' });
    } finally {
      setIsGeneratingReport(false);
    }
  }, [policies, complianceId, clearSelections, showNotification]);

  //   const handleRegenerateSQL = useCallback(async () => {
  //   const selectedPolicyIds = policies.filter((p) => p.selected).map((p) => p.id);

  //   if (selectedPolicyIds.length === 0) {
  //     console.log('No policies selected');
  //     return;
  //   }

  //   setIsRegenerating(true);
  //   try {
  //     const response = await ComplianceCheckAPI.regenerateSQL({
  //       policyIds: selectedPolicyIds,
  //       complianceId,
  //     });

  //     if (response.success) {
  //       setPolicies(response.policies);
  //       console.log(response.message);
  //       clearSelections();
  //     } else {
  //       console.error('Failed to regenerate SQL:', response.message);
  //     }
  //   } catch (error) {
  //     console.error('Error regenerating SQL:', error);
  //   } finally {
  //     setIsRegenerating(false);
  //   }
  // }, [policies, complianceId, clearSelections]);

  const handleEditSQL = useCallback((id: number | string) => {
    setEditingPolicyId(id);
    setIsEditSQLDialogOpen(true);
  }, []);

  const handleCloseEditSQLDialog = useCallback(() => {
    setIsEditSQLDialogOpen(false);
    setEditingPolicyId(null);
  }, []);

  const handleConfirmEditSQL = useCallback(
    (sql: string) => {
      if (editingPolicyId === null) {
        return;
      }

      // Update local state immediately
      setPolicies((prev) =>
        prev.map((policy) =>
          policy.id === editingPolicyId ? { ...policy, generatedSQL: sql } : policy
        )
      );

      handleCloseEditSQLDialog();
    },
    [editingPolicyId, handleCloseEditSQLDialog]
  );

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const response = await ComplianceCheckAPI.savePolicies({
        policies,
        complianceId,
      });

      if (response.success) {
        console.log(response.message);
        showNotification({ type: 'success', message: 'Saved' });
      } else {
        console.error('Failed to save policies:', response.message);
      }
    } catch (error) {
      console.error('Error saving policies:', error);
    } finally {
      setIsSaving(false);
    }
  }, [policies, complianceId]);

  //  const handleApprove = useCallback(async () => {
  //   const selectedPolicyIds = policies.filter((p) => p.selected).map((p) => p.id);

  //   if (selectedPolicyIds.length === 0) {
  //     console.log('No policies selected');
  //     return;
  //   }

  //   setIsApproving(true);
  //   try {
  //     const response = await ComplianceCheckAPI.approvePolicies({
  //       policyIds: selectedPolicyIds,
  //       complianceId,
  //     });

  //     if (response.success) {
  //       setPolicies((prev) =>
  //         prev.map((policy) =>
  //           selectedPolicyIds.includes(policy.id)
  //             ? { ...policy, approvalStatus: 'Approve', selected: false }
  //             : policy
  //         )
  //       );
  //       console.log(response.message);
  //     } else {
  //       console.error('Failed to approve policies:', response.message);
  //     }
  //   } catch (error) {
  //     console.error('Error approving policies:', error);
  //   } finally {
  //     setIsApproving(false);
  //   }
  // }, [policies, complianceId]);

  // Column configuration
  const columns: ColumnConfig[] = [
    // The 'Select' column was intentionally commented out per UI change
    // { key: 'select', header: 'Select', type: 'checkbox', className: styles.selectColumn },

    {
      key: 'policyId',
      header: 'Policy ID',
      type: 'text',
      className: styles.policyIdColumn,
    },
    {
      key: 'policyDescription',
      header: 'Policy description',
      type: 'text',
      className: styles.descriptionColumn,
    },
    // 'Compliance status' column commented out per UI change
    // { key: 'complianceStatus', header: 'Compliance status', type: 'text', className: styles.complianceStatusColumn },

    {
      key: 'generatedSQL',
      header: 'Generated SQL',
      type: 'text',
      className: styles.generatedSQLColumn,
      editable: true, // made editable so users can update generated SQL inline / via edit dialog
      placeholder: 'Edit generated SQL...',
    },
    {
      key: 'commentsOnSQL',
      header: 'Comments on Generated SQL or provide updated SQL',
      type: 'comment',
      className: styles.commentsColumn,
      editable: true,
      placeholder: 'Add comments...',
    },

    // Approval status and Action columns commented out per UI change
    // { key: 'approvalStatus', header: 'Approval status', type: 'approval', className: styles.approvalColumn },
    // { key: 'action', header: 'Action', type: 'action', className: styles.actionColumn },
  ];

  const isAnyLoading = isSaving || isGeneratingReport;

  // Action buttons
  const actionButtons: ActionButton[] = [
    {
      label: 'Generate Report',
      onClick: handleGenerateReport,
      variant: 'contained',
      icon: <DescriptionIcon />,
      className: styles.generateReportButton,
      disabled: !hasSelectedRows || isAnyLoading,
      loading: isGeneratingReport,
    },
    {
      label: 'Save',
      onClick: handleSave,
      variant: 'outlined',
      className: styles.saveButton,
      disabled: !hasSelectedRows || isAnyLoading,
      loading: isSaving,
    },
  ];

  // Loading state
  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <PolicyScannerTable
        title="Compliance Check Results"
        subtitle="Review compliance check results and generated SQL."
        complianceReviewName={complianceName}
        columns={columns}
        data={policies}
        showCheckbox={true}
        actionButtons={actionButtons}
        onCheckboxChange={handleCheckboxChange}
        onSelectAll={handleSelectAll}
        onCommentChange={handleCommentChange}
        onRowAction={handleEditSQL}
        isStepLoading={isAnyLoading}
        loadingMessage="Please wait, we are processing the compliance check."
      />

      {/* Edit SQL Dialog */}
      <EditSQLDialog
        open={isEditSQLDialogOpen}
        onClose={handleCloseEditSQLDialog}
        onConfirm={handleConfirmEditSQL}
        initialSQL={editingPolicy?.generatedSQL || ''}
        policyId={editingPolicy?.policyId}
      />
    </>
  );
};

export default ComplianceCheckPage;
