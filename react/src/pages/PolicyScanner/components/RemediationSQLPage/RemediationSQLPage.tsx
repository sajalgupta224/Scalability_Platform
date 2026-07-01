import React, { useCallback, useEffect, useState } from 'react';
import { Box, CircularProgress } from '@mui/material';
import PolicyScannerTable, { type ColumnConfig } from '../PolicyScannerTable/PolicyScannerTable';
import ScheduleDialog from '../ScheduleDialog/ScheduleDialog';
import SuccessDialog from '../../../../components/ui/SuccessDialog/SuccessDialog';
import { RemediationSQLAPI } from '../../../../api/endpoints/policyScanner.api';
import type { PolicyItem } from '../../../../types/policyScanner.types';
import type { DateRange } from '../../../../types/ui.types';
import styles from '../../PolicyScanner.module.scss';

interface RemediationSQLPageProps {
  complianceId: string;
  complianceName: string;
  isScheduleDialogOpen: boolean;
  onScheduleDialogClose: () => void;
  onJobScheduledSuccess: () => void;
  onLoadingChange?: (loading: boolean) => void;
}

const RemediationSQLPage: React.FC<RemediationSQLPageProps> = ({
  complianceId,
  complianceName,
  isScheduleDialogOpen,
  onScheduleDialogClose,
  onJobScheduledSuccess,
  onLoadingChange,
}) => {
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState<boolean>(false);

  // Handle external loading state
  useEffect(() => {
    onLoadingChange?.(isLoading);
  }, [isLoading, onLoadingChange]);

  // Fetch policies
  useEffect(() => {
    const fetchPolicies = async () => {
      if (!complianceId) return;

      setIsLoading(true);
      try {
        const response = await RemediationSQLAPI.getPolicies(complianceId);

        if (response.success) {
          setPolicies(response.policies);
        } else {
          console.error("Failed to fetch policies:", response.message);
        }
      } catch (error) {
        console.error("Error fetching policies:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPolicies();
  }, [complianceId]);

  // Schedule job handler
  const handleScheduleConfirm = useCallback(
    async (data: { frequency: string; dateRange: DateRange }) => {
      try {
        const response = await RemediationSQLAPI.scheduleJob({
          complianceId,
          frequency: data.frequency,
          dateRange: data.dateRange,
        });

        console.log("Schedule API response:", response);

        if (response) {
          onScheduleDialogClose();
          setIsSuccessDialogOpen(true);
        } else {
          console.error("Failed to schedule job:", response);
        }
      } catch (error) {
        console.error("Error scheduling job:", error);
      }
    },
    [complianceId, onScheduleDialogClose]
  );

  const handleSuccessDialogClose = useCallback(() => {
    setIsSuccessDialogOpen(false);
    onJobScheduledSuccess();
  }, [onJobScheduledSuccess]);

  // Table columns
  const columns: ColumnConfig[] = [
    { key: 'policyId', header: 'Policy ID', type: 'text', className: styles.policyIdColumn },
    { key: 'policyDescription', header: 'Policy description', type: 'text', className: styles.descriptionColumn },
    { key: 'remediationSQL', header: 'Remediation SQL', type: 'text', className: styles.remediationSQLColumn },
    {
      key: 'commentsOnSQL',
      header: 'Comments',
      type: 'comment',
      className: styles.commentsColumn,
      editable: false,
      placeholder: 'Add comments...',
    }
  ];

  // Loading screen
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
        title="List of Remediation SQL Logic"
        subtitle="Review final remediation SQL logic."
        complianceReviewName={complianceName}
        columns={columns}
        data={policies}
        showCheckbox={false}
      />

      {/* Schedule Dialog */}
      <ScheduleDialog
        open={isScheduleDialogOpen}
        onClose={onScheduleDialogClose}
        onConfirm={handleScheduleConfirm}
      />

      {/* Success Dialog */}
      <SuccessDialog
        open={isSuccessDialogOpen}
        onClose={handleSuccessDialogClose}
        message="Job scheduled successfully!"
        subMessage="Your compliance job has been scheduled and will run according to the configured frequency."
        buttonText="OK"
      />
    </>
  );
};

export default RemediationSQLPage;