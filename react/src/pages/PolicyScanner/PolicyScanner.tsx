import React, { useEffect, useState } from 'react';
import { Box, Button, CircularProgress } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { ROUTES } from '../../constants';
import ReviewPoliciesPage from './components/ReviewPoliciesPage/ReviewPoliciesPage';
import ApprovedPoliciesPage from './components/ApprovedPoliciesPage/ApprovedPoliciesPage';
import SnowflakeMappingPage from './components/SnowflakeMappingPage/SnowflakeMappingPage';
import MappedPoliciesTargetTablesPage from './components/MappedPoliciesTargetTablesPage/MappedPoliciesTargetTablesPage';
import ComplianceCheckPage from './components/ComplianceCheckPage/ComplianceCheckPage';
import RemediationScriptGenerationPage from './components/RemediationScriptGenerationPage/RemediationScriptGenerationPage';
import RemediationSQLPage from './components/RemediationSQLPage/RemediationSQLPage';
import styles from './PolicyScanner.module.scss';
 
interface LocationState {
  complianceId?: string;
  complianceName?: string;
  pipelineId?: string;
}
 
// Step configuration for the policy scanner workflow
const STEPS = {
  REVIEW_POLICIES: 1,
  APPROVED_POLICIES: 2,
  SNOWFLAKE_MAPPING: 3,
  MAPPED_POLICIES: 4,
  COMPLIANCE_CHECK: 5,
  REMEDIATION_SCRIPT: 6,
  REMEDIATION_SQL: 7,
} as const;
 
const STEP_CONFIG = {
  [STEPS.REVIEW_POLICIES]: {
    label: 'Review Policies',
    nextButtonText: 'View Approved Policies',
  },
  [STEPS.APPROVED_POLICIES]: {
    label: 'Approved Policies',
    nextButtonText: 'Generate Snowflake Mapping',
  },
  [STEPS.SNOWFLAKE_MAPPING]: {
    label: 'Snowflake Mapping',
    nextButtonText: 'Proceed to Mapped Policies',
  },
  [STEPS.MAPPED_POLICIES]: {
    label: 'Mapped Policies',
    nextButtonText: 'Proceed to Compliance Check',
  },
  [STEPS.COMPLIANCE_CHECK]: {
    label: 'Compliance Check',
    nextButtonText: 'Proceed to Remediation Script',
  },
  [STEPS.REMEDIATION_SCRIPT]: {
    label: 'Remediation Script Generation',
    nextButtonText: 'Proceed to Remediation SQL',
  },
  [STEPS.REMEDIATION_SQL]: {
    label: 'Remediation SQL',
    nextButtonText: 'Schedule Job',
  },
} as const;
 
const TOTAL_STEPS = Object.keys(STEPS).length;
 
const PolicyScanner: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState;
 
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [complianceId, setComplianceId] = useState<string>('');
  const [isInitializing, setIsInitializing] = useState<boolean>(true);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState<boolean>(false);
  const [isStepLoading, setIsStepLoading] = useState<boolean>(false);
 
  // 🔹 NEW: auto-generate mapping in the Snowflake step immediately after navigation
  const [autoGenerateMapping, setAutoGenerateMapping] = useState<boolean>(false);
 
  // Initialize complianceId from navigation state
  useEffect(() => {
    const checkId = locationState?.complianceId;
 
    if (!checkId) {
      console.error('No compliance check ID provided');
      navigate(ROUTES.CREATE_RA_COMPLIANCE);
      return;
    }
 
    setComplianceId(checkId);
    setIsInitializing(false);
  }, [locationState, navigate]);
 
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      navigate(ROUTES.CREATE_RA_COMPLIANCE);
    }
  };
 
  const handleProceed = () => {
    // 🔹 When on Approved Policies, navigate to Snowflake Mapping and auto-generate
    if (currentStep === STEPS.APPROVED_POLICIES) {
      setAutoGenerateMapping(true);
      setCurrentStep(STEPS.SNOWFLAKE_MAPPING);
      return;
    }
 
    if (currentStep < TOTAL_STEPS) {
      setCurrentStep(currentStep + 1);
    } else if (currentStep === TOTAL_STEPS) {
      // On final step, open the schedule dialog
      setIsScheduleDialogOpen(true);
    }
  };
 
  const handleScheduleDialogClose = () => {
    setIsScheduleDialogOpen(false);
  };
 
  const handleJobScheduledSuccess = () => {
    navigate(ROUTES.RA_COMPLIANCE);
  };
 
  const handleStepLoadingChange = (loading: boolean) => {
    setIsStepLoading(loading);
  };
 
  const getProceedButtonText = () => {
    const stepConfig = STEP_CONFIG[currentStep as keyof typeof STEP_CONFIG];
    return stepConfig?.nextButtonText ?? 'Proceed';
  };
 
  const complianceName = locationState?.complianceName || 'GDPR Client Claims Check';
 
  const renderStepContent = () => {
    switch (currentStep) {
      case STEPS.REVIEW_POLICIES:
        return (
          <ReviewPoliciesPage
            complianceId={complianceId}
            complianceName={complianceName}
            onLoadingChange={handleStepLoadingChange}
          />
        );
      case STEPS.APPROVED_POLICIES:
        return (
          <ApprovedPoliciesPage
            complianceId={complianceId}
            complianceName={complianceName}
            onLoadingChange={handleStepLoadingChange}
          />
        );
      case STEPS.SNOWFLAKE_MAPPING:
        return (
          <SnowflakeMappingPage
            complianceId={complianceId}
            complianceName={complianceName}
            onLoadingChange={handleStepLoadingChange}
            // 🔹 Trigger auto-generation when arriving from Approved Policies
            autoGenerate={autoGenerateMapping}
            onAutoGenerateHandled={() => setAutoGenerateMapping(false)}
          />
        );
      case STEPS.MAPPED_POLICIES:
        return (
          <MappedPoliciesTargetTablesPage
            complianceId={complianceId}
            complianceName={complianceName}
            onLoadingChange={handleStepLoadingChange}
          />
        );
      case STEPS.COMPLIANCE_CHECK:
        return (
          <ComplianceCheckPage
            complianceId={complianceId}
            complianceName={complianceName}
            onLoadingChange={handleStepLoadingChange}
          />
        );
      case STEPS.REMEDIATION_SCRIPT:
        return (
          <RemediationScriptGenerationPage
            complianceId={complianceId}
            complianceName={complianceName}
            onLoadingChange={handleStepLoadingChange}
          />
        );
      case STEPS.REMEDIATION_SQL:
        return (
          <RemediationSQLPage
            complianceId={complianceId}
            complianceName={complianceName}
            isScheduleDialogOpen={isScheduleDialogOpen}
            onScheduleDialogClose={handleScheduleDialogClose}
            onJobScheduledSuccess={handleJobScheduledSuccess}
            onLoadingChange={handleStepLoadingChange}
          />
        );
      default:
        return null;
    }
  };
 
  // Show loading state while initializing
  if (isInitializing) {
    return (
      <div className={styles.graywrapper}>
        <h3 className={styles.wrappertitle}>Application</h3>
        <p className={styles.wrapperdesc}>
          <span
            style={{ color: 'blue', cursor: 'pointer' }}
            onClick={() => navigate(ROUTES.RA_COMPLIANCE)}
          >
            Regulatory &amp; Audit Compliance
          </span>{' '}
          /{' '}
          <span
            style={{ color: 'blue', cursor: 'pointer' }}
            onClick={() => navigate(ROUTES.CREATE_RA_COMPLIANCE)}
          >
            Regulatory and Audit Agent
          </span>{' '}
          / Policy scanner
        </p>
        <Box
          className={styles.container}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '400px',
          }}
        >
          <CircularProgress />
        </Box>
      </div>
    );
  }
 
  return (
    <div className={styles.graywrapper}>
      <h3 className={styles.wrappertitle}>Application</h3>
      <p className={styles.wrapperdesc}>
        <span
          style={{ color: 'blue', cursor: 'pointer' }}
          onClick={() => navigate(ROUTES.RA_COMPLIANCE)}
        >
          Regulatory &amp; Audit Compliance
        </span>{' '}
        /{' '}
        <span
          style={{ color: 'blue', cursor: 'pointer' }}
          onClick={() => navigate(ROUTES.CREATE_RA_COMPLIANCE)}
        >
          Regulatory and Audit Agent
        </span>{' '}
        / Policy scanner
      </p>
 
      <Box className={styles.container}>
        {renderStepContent()}
 
        {/* Navigation Buttons - Bottom */}
        <Box className={styles.navigationButtons}>
          <Button
            variant="outlined"
            onClick={handleBack}
            startIcon={<ArrowBackIcon />}
            className={styles.backButton}
            disabled={isStepLoading}
          >
            Back
          </Button>
          {currentStep <= TOTAL_STEPS && (
            <Button
              variant="contained"
              onClick={handleProceed}
              endIcon={<ArrowForwardIcon />}
              className={styles.proceedButton}
              disabled={isStepLoading}
            >
              {getProceedButtonText()}
            </Button>
          )}
        </Box>
      </Box>
    </div>
  );
};
 
export default PolicyScanner;