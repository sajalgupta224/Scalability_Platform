
import React, { useEffect, useState } from 'react';
import { Box, CircularProgress, TextField } from '@mui/material';
import PolicyScannerTable, { type ColumnConfig } from '../PolicyScannerTable/PolicyScannerTable';
import { ApprovedPoliciesAPI } from '../../../../api/endpoints/policyScanner.api';
import type { PolicyItem } from '../../../../types/policyScanner.types';
import styles from '../../PolicyScanner.module.scss';

interface ApprovedPoliciesPageProps {
  complianceId: string;
  complianceName: string;
  onLoadingChange?: (loading: boolean) => void;
}

const mapApiPolicyToUiPolicy = (p: any): PolicyItem => ({
  id: p.POLICY_ID ?? p.id ?? `row-${Math.random()}`,
  policyId: p.POLICY_ID ?? p.policyId ?? '',
  policyDescription: p.POLICY_TEXT ?? p.policyDescription ?? '',
  policyType: p.POLICY_TYPE ?? p.policyType ?? '',
  complianceDataRequirement: p.COMPLIANCE_DATA_REQUIREMENT ?? p.complianceDataRequirement ?? '',
  citations: p.CITATION_DOC ?? p.citations ?? '',
  articleDisplay: p.ARTICLEDISPLAY ?? p.articleDisplay ?? '',
  approvalStatus: p.APPROVAL_STATUS ?? p.approvalStatus ?? '',
  comments: p.comments ?? '',
  selected: p.selected ?? false,
});

const ApprovedPoliciesPage: React.FC<ApprovedPoliciesPageProps> = ({
  complianceId,
  complianceName,
  onLoadingChange,
}) => {
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => onLoadingChange?.(isLoading), [isLoading, onLoadingChange]);

  useEffect(() => {
    const fetchPolicies = async () => {
      if (!complianceId) return;

      setIsLoading(true);
      try {
        const resp = await ApprovedPoliciesAPI.getPolicies(complianceId);
        const rawList = (resp as any).policies ?? (resp as any).data ?? [];

        if ((resp as any).success) {
          setPolicies(rawList.map(mapApiPolicyToUiPolicy));
        } else {
          console.error('Failed to fetch approved policies:', (resp as any).message);
        }
      } catch (err) {
        console.error('Error fetching approved policies:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPolicies();
  }, [complianceId]);

  const renderArticleDisplayCell = (value: string) => (
    <TextField
      size="small"
      fullWidth
      value={value ?? ''}
      InputProps={{ readOnly: true }}
      sx={{ '& .MuiOutlinedInput-root': { height: 40, borderRadius: 1.5 } }}
    />
  );

  const columns: ColumnConfig[] = [
    { key: 'policyId', header: 'Policy ID', type: 'text', className: styles.policyIdColumn },
    { key: 'policyDescription', header: 'Policy Description', type: 'text', className: styles.descriptionColumn },
    { key: 'policyType', header: 'Policy Type', type: 'text', className: styles.policyTypeColumn },
    { key: 'complianceDataRequirement', header: 'Data Requirement', type: 'text', className: styles.complianceDataRequirementColumn },
    { key: 'citations', header: 'Citations', type: 'text', className: styles.citationsColumn },

    {
      key: 'articleDisplay',
      header: 'Article Display',
      type: 'custom',
      className: styles.articleDisplayColumn,
      render: (value: string) => renderArticleDisplayCell(value),
    },

    {
      key: 'comments',
      header: 'Comments',
      type: 'comment',
      className: styles.commentsColumn,
      editable: false,
      placeholder: 'Add comments...',
    },
    { key: 'approvalStatus', header: 'Approval Status', type: 'approval', className: styles.approvalColumn },
  ];

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <PolicyScannerTable
      title="List of approved policies"
      subtitle="Take a quick look at your policies details to make sure everything looks good before moving forward."
      complianceReviewName={complianceName}
      columns={columns}
      data={policies}
      showCheckbox={false}
      actionButtons={[]}
    />
  );
};

export default ApprovedPoliciesPage;
