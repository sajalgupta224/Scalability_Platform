
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, Alert } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PolicyScannerTable, {
  type ActionButton,
  type ColumnConfig,
} from '../PolicyScannerTable/PolicyScannerTable';
import { RemediationScriptAPI } from '../../../../api/endpoints/policyScanner.api';
import type { PolicyItem } from '../../../../types/policyScanner.types';
import styles from '../../PolicyScanner.module.scss';

interface RemediationScriptGenerationPageProps {
  complianceId: string;
  complianceName: string;
  onLoadingChange?: (loading: boolean) => void;
}

/** Store comments by policyId (because regenerate API is policyId-based) */
const commentStoreKey = (complianceId: string) => `remediationCommentsByPolicy:${complianceId}`;

function loadCommentMap(complianceId: string): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(commentStoreKey(complianceId));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCommentMap(complianceId: string, map: Record<string, string>) {
  try {
    sessionStorage.setItem(commentStoreKey(complianceId), JSON.stringify(map));
  } catch {
    // ignore
  }
}

/** Normalize null description to visible "null" */
const normalizePoliciesForUI = (items: PolicyItem[]): PolicyItem[] =>
  items.map((p) => ({
    ...p,
    policyDescription: (p as any).policyDescription === null ? 'null' : p.policyDescription,
  }));

/** Apply stored comments to fetched policies */
function overlayCommentsFromStorage(complianceId: string, items: PolicyItem[]): PolicyItem[] {
  const map = loadCommentMap(complianceId);
  return items.map((p) => {
    const stored = map[String(p.policyId)];
    return stored ? { ...p, commentsOnSQL: stored } : p;
  });
}

const RemediationScriptGenerationPage: React.FC<RemediationScriptGenerationPageProps> = ({
  complianceId,
  complianceName,
  onLoadingChange,
}) => {
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const selectedPolicies = useMemo(() => policies.filter((p) => p.selected), [policies]);
  const hasSelectedRows = selectedPolicies.length > 0;

  useEffect(() => {
    onLoadingChange?.(isLoading || isSaving || isApproving || isRegenerating);
  }, [isLoading, isSaving, isApproving, isRegenerating, onLoadingChange]);

  const refresh = useCallback(async () => {
    const response = await RemediationScriptAPI.getPolicies(complianceId);

    if (response.success) {
      const normalized = normalizePoliciesForUI(response.policies);
      const withStoredComments = overlayCommentsFromStorage(complianceId, normalized);
      setPolicies(withStoredComments);
    } else {
      console.error('Failed to fetch remediation policies:', response.message);
      setPolicies([]);
    }
  }, [complianceId]);

  useEffect(() => {
    const fetchPolicies = async () => {
      if (!complianceId) return;

      setIsLoading(true);
      try {
        await refresh();
      } catch (error) {
        console.error('Error fetching policies:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPolicies();
  }, [complianceId, refresh]);

  const clearSelections = useCallback(() => {
    setPolicies((prev) => prev.map((p) => ({ ...p, selected: false })));
  }, []);

  const handleCheckboxChange = useCallback((id: number | string) => {
    setPolicies((prev) =>
      prev.map((policy) =>
        String(policy.id) === String(id)
          ? { ...policy, selected: !policy.selected }
          : policy
      )
    );
  }, []);

  const handleSelectAll = useCallback((selectAll: boolean) => {
    setPolicies((prev) => prev.map((policy) => ({ ...policy, selected: selectAll })));
  }, []);

  /**
   * ✅ When user types comment in table:
   * - update state
   * - store by policyId so Page-2 can reflect it
   */
  const handleCommentChange = useCallback(
    (id: number | string, field: string, value: string) => {
      if (field !== 'commentsOnSQL') return;

      setPolicies((prev) => {
        const next = prev.map((policy) =>
          String(policy.id) === String(id)
            ? { ...policy, commentsOnSQL: value }
            : policy
        );

        const changed = next.find((p) => String(p.id) === String(id));
        if (changed) {
          const map = loadCommentMap(complianceId);
          map[String(changed.policyId)] = value;
          saveCommentMap(complianceId, map);
        }

        return next;
      });
    },
    [complianceId]
  );

  /**
   * ✅ Regenerate SQL:
   * - Validate comment exists for each selected policyId
   * - Send comment as userComment (policyId-based)
   * - Persist comment to storage (again) to be safe
   * - Refresh after success
   */
  const handleRegenerateSQL = useCallback(async () => {
    setErrorMessage('');

    if (!hasSelectedRows) return;

    const missing = selectedPolicies.filter((p) => !(p.commentsOnSQL || '').trim());
    if (missing.length > 0) {
      const ids = missing.map((m) => String(m.policyId)).join(', ');
      setErrorMessage(`Please add comment in "Comments..." for selected Policy ID(s): ${ids}`);
      return;
    }

    setIsRegenerating(true);
    try {
      // ✅ persist selected comments by policyId (ensures page-2 shows it)
      const map = loadCommentMap(complianceId);
      selectedPolicies.forEach((p) => {
        map[String(p.policyId)] = (p.commentsOnSQL || '').trim();
      });
      saveCommentMap(complianceId, map);

      // ✅ Call regenerate per selected policyId using its comment
      const results = await Promise.allSettled(
        selectedPolicies.map((p) =>
          RemediationScriptAPI.regenerateSQL({
            policyIds: [p.policyId],
            complianceId,
            userComment: (p.commentsOnSQL || '').trim(),
          })
        )
      );

      const failed = results.find(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
      );

      if (failed) {
        if (failed.status === 'rejected') {
          setErrorMessage(failed.reason?.message ?? 'Regenerate SQL failed');
        } else {
          setErrorMessage(failed.value.message ?? 'Regenerate SQL failed');
        }
        return;
      }

      await refresh();
      clearSelections();
    } catch (error: any) {
      console.error('Error regenerating SQL:', error);
      setErrorMessage(error?.message ?? 'Error regenerating SQL');
    } finally {
      setIsRegenerating(false);
    }
  }, [hasSelectedRows, selectedPolicies, complianceId, refresh, clearSelections]);

  const handleSave = useCallback(async () => {
    if (!hasSelectedRows) return;

    setIsSaving(true);
    try {
      const response = await RemediationScriptAPI.savePolicies({
        policies: selectedPolicies,
        complianceId,
      });

      if (response.success) {
        await refresh();
        clearSelections();
      } else {
        setErrorMessage(response.message || 'Failed to save policies');
      }
    } catch (error: any) {
      console.error('Error saving policies:', error);
      setErrorMessage(error?.message ?? 'Error saving policies');
    } finally {
      setIsSaving(false);
    }
  }, [hasSelectedRows, selectedPolicies, complianceId, refresh, clearSelections]);

  const handleApprove = useCallback(async () => {
    if (!hasSelectedRows) return;

    const selectedPolicyIds = selectedPolicies.map((p) => p.policyId);

    setIsApproving(true);
    try {
      const response = await RemediationScriptAPI.approvePolicies({
        policyIds: selectedPolicyIds,
        complianceId,
      });

      if (response.success) {
        await refresh();
        clearSelections();
      } else {
        setErrorMessage(response.message || 'Failed to approve policies');
      }
    } catch (error: any) {
      console.error('Error approving policies:', error);
      setErrorMessage(error?.message ?? 'Error approving policies');
    } finally {
      setIsApproving(false);
    }
  }, [hasSelectedRows, selectedPolicies, complianceId, refresh, clearSelections]);

  const columns: ColumnConfig[] = [
    { key: 'policyId', header: 'Policy ID', type: 'text', className: styles.policyIdColumn },
    { key: 'policyDescription', header: 'Policy description', type: 'text', className: styles.descriptionColumn },
    { key: 'remediationSQL', header: 'Remediation SQL', type: 'text', className: styles.remediationSQLColumn },
    {
      key: 'commentsOnSQL',
      header: 'Comments on Generated SQL or provide updated SQL',
      type: 'comment',
      className: styles.commentsColumn,
      editable: true,
      placeholder: 'Add comments...',
    },
    // { key: 'approvalStatus', header: 'Approval status', type: 'approval', className: styles.approvalColumn },
  ];

  const actionButtons: ActionButton[] = [
    {
      label: 'Regenerate SQL',
      onClick: handleRegenerateSQL,
      variant: 'contained',
      icon: <RefreshIcon />,
      className: styles.regenerateButton,
      disabled: !hasSelectedRows || isRegenerating || isSaving || isApproving,
      loading: isRegenerating,
    },
    {
      label: 'Save',
      onClick: handleSave,
      variant: 'outlined',
      className: styles.saveButton,
      disabled: !hasSelectedRows || isSaving || isRegenerating || isApproving,
      loading: isSaving,
    }
  ];

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      {errorMessage ? (
        <Box sx={{ mb: 2 }}>
          <Alert severity="error" onClose={() => setErrorMessage('')}>
            {errorMessage}
          </Alert>
        </Box>
      ) : null}

      <PolicyScannerTable
        title="Remediation Policy Script Generation"
        subtitle="Generate and review remediation SQL scripts."
        complianceReviewName={complianceName}
        columns={columns}
        data={policies}
        showCheckbox={true}
        actionButtons={actionButtons}
        onCheckboxChange={handleCheckboxChange}
        onSelectAll={handleSelectAll}
        onCommentChange={handleCommentChange}
        isStepLoading={isSaving || isApproving || isRegenerating}
        loadingMessage="Please wait, we are processing the remediation script."
      />
    </>
  );
};

export default RemediationScriptGenerationPage;
