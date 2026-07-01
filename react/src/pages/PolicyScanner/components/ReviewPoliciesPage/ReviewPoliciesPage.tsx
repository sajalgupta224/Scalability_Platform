
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, CircularProgress, IconButton, TextField } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';

import PolicyScannerTable, {
  type ActionButton,
  type ColumnConfig,
} from '../PolicyScannerTable/PolicyScannerTable';

import AddNewRuleDialog from '../AddNewRuleDialog/AddNewRuleDialog';
import EditFieldDialog from '../EditFieldDialog/EditFieldDialog';
import { ReviewPoliciesAPI } from '../../../../api/endpoints/policyScanner.api';
import type { PolicyItem } from '../../../../types/policyScanner.types';
import styles from '../../PolicyScanner.module.scss';

interface ReviewPoliciesPageProps {
  complianceId: string;
  complianceName: string;
  onLoadingChange?: (loading: boolean) => void;
}

/**
 * If your API already returns PolicyItem[] (via transformRawPolicy),
 * this map still works (just passes through).
 */
const mapApiPolicyToUiPolicy = (p: any): PolicyItem => ({
  id: p.id ?? p.POLICY_ID ?? `row-${Math.random()}`,
  policyId: p.policyId ?? p.POLICY_ID ?? '',
  policyDescription: p.policyDescription ?? p.POLICY_TEXT ?? '',
  policyType: p.policyType ?? p.POLICY_TYPE ?? '',
  complianceDataRequirement: p.complianceDataRequirement ?? p.COMPLIANCE_DATA_REQUIREMENT ?? '',
  citations: p.citations ?? p.CITATION_DOC ?? '',
  articleDisplay:
    p.articleDisplay ??
    p.ARTICLEDISPLAY ??
    p.ARTICLE_DISPLAY ??
    p.article_display ??
    '',
  approvalStatus: p.approvalStatus ?? p.APPROVAL_STATUS ?? '',
  comments: p.comments ?? p.REGENERATION_COMMENT ?? '',
  selected: Boolean(p.selected),
});

const ReviewPoliciesPage: React.FC<ReviewPoliciesPageProps> = ({
  complianceId,
  complianceName,
  onLoadingChange,
}) => {
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<boolean>(false);
  const [isRegenerating, setIsRegenerating] = useState<boolean>(false);
  const [isAddRuleDialogOpen, setIsAddRuleDialogOpen] = useState<boolean>(false);

  const [isEditFieldDialogOpen, setIsEditFieldDialogOpen] = useState<boolean>(false);
  const [editingPolicyId, setEditingPolicyId] = useState<number | string | null>(null);
  const [editingField, setEditingField] = useState<
    'policyDescription' | 'policyType' | 'complianceDataRequirement' | null
  >(null);

  const hasSelectedRows = useMemo(() => policies.some((p) => p.selected), [policies]);

  useEffect(() => {
    const isAnyLoading = isLoading || isSaving || isApproving || isRegenerating;
    onLoadingChange?.(isAnyLoading);
  }, [isLoading, isSaving, isApproving, isRegenerating, onLoadingChange]);

  // Fetch policies
  useEffect(() => {
    const fetchPolicies = async () => {
      if (!complianceId) return;

      const sessionKey = `policies_fetched_${complianceId}`;
      const hasAlreadyFetched = sessionStorage.getItem(sessionKey);

      setIsLoading(true);
      try {
        if (!hasAlreadyFetched) {
          const prompt = `list all the policies of gdpr where regulation id is ${complianceId}`;
          await ReviewPoliciesAPI.fetchPoliciesFromAgent(prompt);
          sessionStorage.setItem(sessionKey, 'true');
        }

        const resp = await ReviewPoliciesAPI.getPolicies(complianceId);
        const rawList = (resp as any).policies ?? (resp as any).data ?? [];
        if ((resp as any).success) {
          setPolicies(rawList.map(mapApiPolicyToUiPolicy));
        } else {
          console.error('Failed to fetch policies:', (resp as any).message);
        }
      } catch (err) {
        console.error('Error fetching policies:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPolicies();
  }, [complianceId]);

  // Selection handlers
  const handleCheckboxChange = useCallback((id: number | string) => {
    setPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, selected: !p.selected } : p)));
  }, []);

  const handleSelectAll = useCallback((selectAll: boolean) => {
    setPolicies((prev) => prev.map((p) => ({ ...p, selected: selectAll })));
  }, []);

  const handleCommentChange = useCallback((id: number | string, _field: string, value: string) => {
    setPolicies((prev) => prev.map((p) => (p.id === id ? { ...p, comments: value } : p)));
  }, []);

  const clearSelections = useCallback(() => {
    setPolicies((prev) => prev.map((p) => ({ ...p, selected: false })));
  }, []);

  // ✅ Regenerate
  // const handleRegeneratePolicy = useCallback(async () => {
  //   const selectedPolicies = policies.filter((p) => p.selected);
  //   if (selectedPolicies.length === 0) return;

  //   setIsRegenerating(true);
  //   try {
  //     const policyDetails = selectedPolicies
  //       .map((p) => `POLICY_ID=${p.policyId},REGENERATION_COMMENT=${p.comments || ''},`)
  //       .join(' and ');

  //     const prompt = `For regulationId ${complianceId}, regenerate the policy with ${policyDetails}`;
  //     await ReviewPoliciesAPI.fetchPoliciesFromAgent(prompt);

  //     const resp = await ReviewPoliciesAPI.getPolicies(complianceId);
  //     const rawList = (resp as any).policies ?? (resp as any).data ?? [];
  //     if ((resp as any).success) setPolicies(rawList.map(mapApiPolicyToUiPolicy));
  //   } catch (err) {
  //     console.error('Error regenerating policy:', err);
  //   } finally {
  //     setIsRegenerating(false);
  //     clearSelections();
  //   }
  // }, [policies, complianceId, clearSelections]);

  // ✅ Add new rule dialog
  const handleAddNewRules = useCallback(() => setIsAddRuleDialogOpen(true), []);
  const handleCloseAddRuleDialog = useCallback(() => setIsAddRuleDialogOpen(false), []);

  const handleConfirmAddRule = useCallback((description: string) => {
    setIsAddRuleDialogOpen(false);

    const newPolicy: PolicyItem = {
      id: `new-${Date.now()}`,
      policyId: '',
      policyDescription: description,
      policyType: '',
      complianceDataRequirement: '',
      citations: '',
      articleDisplay: '',
      comments: '',
      approvalStatus: 'LISTED',
      selected: true,
    };

    setPolicies((prev) => [...prev, newPolicy]);
  }, []);

  // ✅ Edit field dialog
  const handleEditField = useCallback(
    (policyId: number | string, field: 'policyDescription' | 'policyType' | 'complianceDataRequirement') => {
      setEditingPolicyId(policyId);
      setEditingField(field);
      setIsEditFieldDialogOpen(true);
    },
    []
  );

  const handleCloseEditFieldDialog = useCallback(() => {
    setIsEditFieldDialogOpen(false);
    setEditingPolicyId(null);
    setEditingField(null);
  }, []);

  const handleConfirmEditField = useCallback(
    (value: string) => {
      if (editingPolicyId !== null && editingField !== null) {
        setPolicies((prev) =>
          prev.map((p) => (p.id === editingPolicyId ? { ...p, [editingField]: value } : p))
        );
      }
      handleCloseEditFieldDialog();
    },
    [editingPolicyId, editingField, handleCloseEditFieldDialog]
  );

  // ✅ SAVE (agent prompt style)
  const handleSave = useCallback(async () => {
    const selectedPolicies = policies.filter((p) => p.selected);
    if (selectedPolicies.length === 0) {
      console.log('No policies selected');
      return;
    }

    setIsSaving(true);
    try {
      const existingPolicies = selectedPolicies.filter((p) => Number(p.policyId) > 0);
      const newPolicies = selectedPolicies.filter((p) => !(Number(p.policyId) > 0));

      const existingPolicyDetails = existingPolicies
        .map(
          (p) =>
            `POLICY_ID=${p.policyId},` +
            `POLICY_TEXT=${p.policyDescription},` +
            `POLICY_TYPE=${p.policyType || ''},` +
            `COMPLIANCE_DATA_REQUIREMENT=${p.complianceDataRequirement || ''},` +
            `CITATION_DOC=${p.citations || ''},` +
            `ARTICLEDISPLAY=${p.articleDisplay || ''},` +
            `REGENERATION_COMMENT=${p.comments || ''},` +
            `APPROVAL_STATUS=${p.approvalStatus || ''}`
        )
        .join(' and ');

      const newPolicyDetails = newPolicies
        .map((p) => `POLICY_TEXT=${p.policyDescription}`)
        .join(' and ');

      let prompt = `For regulationId ${complianceId}`;
      if (existingPolicies.length > 0) prompt += `, save the policy with ${existingPolicyDetails}`;
      if (newPolicies.length > 0) {
        if (existingPolicies.length > 0) prompt += ' and';
        prompt += `, create new policy with ${newPolicyDetails}`;
      }

      await ReviewPoliciesAPI.fetchPoliciesFromAgent(prompt);

      const resp = await ReviewPoliciesAPI.getPolicies(complianceId);
      const rawList = (resp as any).policies ?? (resp as any).data ?? [];
      if ((resp as any).success) setPolicies(rawList.map(mapApiPolicyToUiPolicy));
    } catch (err) {
      console.error('Error saving policies:', err);
    } finally {
      setIsSaving(false);
    }
  }, [policies, complianceId]);

  // ✅ APPROVE (calls backend approve API)
  const handleApprove = useCallback(async () => {
    const selectedPolicies = policies.filter((p) => p.selected);

    if (selectedPolicies.length === 0) {
      console.log('No policies selected');
      return;
    }

    setIsApproving(true);
    try {
      const payload = {
        policies: selectedPolicies
          .map((p) => ({
            policy_id: Number(p.policyId),
            pipeline_id: 1,
            regulation_id: Number(complianceId),
            policy_text: p.policyDescription ?? '',
            policy_type: p.policyType ?? '',
            control_mapping: '',
            risk_area: '',
            citation_doc: p.citations ?? '',
            citation_chunk_ref: '',
            EFFECTIVE_START_DT: '1900-01-01',
            EFFECTIVE_END_DT: '1900-01-01',
            regeneration_comment: p.comments ?? null,
            compliance_data_requirement: p.complianceDataRequirement ?? '',
          }))
          // approve only existing DB rows
          .filter((x) => Number.isInteger(x.policy_id) && x.policy_id > 0),
      };

      if (payload.policies.length === 0) {
        console.log('No valid DB policies selected to approve');
        return;
      }

      console.log('Approve payload:', payload);
      const approveResp = await ReviewPoliciesAPI.approvePolicies(payload);
      console.log('Approve response:', approveResp);

      if (!approveResp.success) {
        console.error('Approve failed:', approveResp.message);
        return;
      }

      // Refresh table
      const resp = await ReviewPoliciesAPI.getPolicies(complianceId);
      const rawList = (resp as any).policies ?? (resp as any).data ?? [];
      if ((resp as any).success) setPolicies(rawList.map(mapApiPolicyToUiPolicy));
    } catch (err) {
      console.error('Error approving policies:', err);
    } finally {
      setIsApproving(false);
    }
  }, [policies, complianceId]);

  // UI cell renders
  const renderEditableCell = (
    value: string,
    row: PolicyItem,
    field: 'policyDescription' | 'policyType' | 'complianceDataRequirement'
  ) => (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <span style={{ flex: 1 }}>{value}</span>
      <IconButton size="small" onClick={() => handleEditField(row.id, field)} sx={{ padding: '2px' }}>
        <EditIcon sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );

  const renderArticleDisplayCell = (value: string) => (
    <TextField
      size="small"
      fullWidth
      value={value ?? ''}
      InputProps={{ readOnly: true }}
      sx={{ '& .MuiOutlinedInput-root': { height: 40, borderRadius: 1.5 } }}
    />
  );

  // Columns
  const columns: ColumnConfig[] = [
    { key: 'policyId', header: 'Policy ID', type: 'text', className: styles.policyIdColumn },
    {
      key: 'policyDescription',
      header: 'Policy Description',
      type: 'custom',
      className: styles.descriptionColumn,
      render: (value: string, row: PolicyItem) => renderEditableCell(value, row, 'policyDescription'),
    },
    {
      key: 'policyType',
      header: 'Policy Type',
      type: 'custom',
      className: styles.policyTypeColumn,
      render: (value: string, row: PolicyItem) => renderEditableCell(value, row, 'policyType'),
    },
    {
      key: 'complianceDataRequirement',
      header: 'Data Requirement',
      type: 'custom',
      className: styles.complianceDataRequirementColumn,
      render: (value: string, row: PolicyItem) => renderEditableCell(value, row, 'complianceDataRequirement'),
    },
    { key: 'citations', header: 'Citations', type: 'text', className: styles.citationsColumn },
    {
      key: 'articleDisplay',
      header: 'Article Display',
      type: 'custom',
      className: styles.articleDisplayColumn,
      render: (_v: any, row: PolicyItem) => renderArticleDisplayCell(row.articleDisplay ?? ''),
    },
    {
      key: 'comments',
      header: 'Comments',
      type: 'comment',
      className: styles.commentsColumn,
      editable: true,
      placeholder: 'Add comments...',
    },
    { key: 'approvalStatus', header: 'Approval Status', type: 'approval', className: styles.approvalColumn },
  ];

  // ✅ ACTION BUTTONS (wired properly)
  const actionButtons: ActionButton[] = [
    // {
    //   label: 'Regenerate policy',
    //   onClick: handleRegeneratePolicy,
    //   variant: 'contained',
    //   icon: <RefreshIcon />,
    //   className: styles.regenerateButton,
    //   disabled: !hasSelectedRows || isRegenerating || isSaving || isApproving,
    //   loading: isRegenerating,
    // },
    {
      label: 'Add new rules',
      onClick: handleAddNewRules,
      variant: 'contained',
      icon: <AddIcon />,
      className: styles.addRulesButton,
      disabled: isRegenerating || isSaving || isApproving,
    },
    {
      label: 'Save',
      onClick: handleSave,
      variant: 'outlined',
      className: styles.saveButton,
      disabled: !hasSelectedRows || isSaving || isRegenerating || isApproving,
      loading: isSaving,
    },
    {
      label: 'Approve',
      onClick: handleApprove,
      variant: 'contained',
      className: styles.approveButton,
      disabled: !hasSelectedRows || isSaving || isRegenerating || isApproving,
      loading: isApproving,
    },
  ];

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '400px', gap: '16px' }}>
        <CircularProgress />
        <span>Analyzing and retrieving the policy details.</span>
      </Box>
    );
  }

  return (
    <>
      <PolicyScannerTable
        title="Policy scanner"
        subtitle="Review and approve Policies"
        complianceReviewName={complianceName}
        columns={columns}
        data={policies}
        showCheckbox={true}
        actionButtons={actionButtons}
        onCheckboxChange={handleCheckboxChange}
        onSelectAll={handleSelectAll}
        onCommentChange={handleCommentChange}
        isStepLoading={isSaving || isApproving || isRegenerating}
        loadingMessage="Please wait, we are updating the policies."
      />

      <AddNewRuleDialog
        open={isAddRuleDialogOpen}
        onClose={handleCloseAddRuleDialog}
        onConfirm={handleConfirmAddRule}
      />

      <EditFieldDialog
        open={isEditFieldDialogOpen}
        fieldLabel={
          editingField === 'policyDescription'
            ? 'Policy Description'
            : editingField === 'policyType'
              ? 'Policy Type'
              : 'Data Requirement'
        }
        currentValue={
          editingPolicyId !== null && editingField !== null
            ? (policies.find((p) => p.id === editingPolicyId)?.[editingField] as string) || ''
            : ''
        }
        onClose={handleCloseEditFieldDialog}
        onConfirm={handleConfirmEditField}
      />
    </>
  );
};

export default ReviewPoliciesPage;
