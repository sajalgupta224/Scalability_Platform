import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { ROUTES } from '../../constants';
import styles from './CreateRACompliance.module.scss';
import Dropdown from '../../components/ui/Dropdown/Dropdown';
import HelpIcon from '../../components/ui/HelpIcon/HelpIcon';
import { RAComplianceAPI } from '../../api/endpoints/racompliance.api';
import { PipelineAPI } from '../../api/endpoints/pipeline.api';
import type { DropdownOption } from '../../types/ui.types';

const REGULATION_TYPE_OPTIONS: DropdownOption[] = [
  { label: 'All Category', value: 'all Category' },
  { label: 'Data Requirements', value: 'data Requirements' },
];

const CreateRACompliance: React.FC = () => {
  const navigate = useNavigate();

  // Form state
  const [regulationName, setRegulationName] = useState('');
  const [selectedPipeline, setSelectedPipeline] = useState<string>('');
  const [regulationType, setRegulationType] = useState<string>('');
  const [inputControls, setInputControls] = useState('');

  // Dropdown data
  const [pipelineOptions, setPipelineOptions] = useState<DropdownOption[]>([]);
  const [isLoadingPipelines, setIsLoadingPipelines] = useState(false);

  // UX state
  const [isCreating, setIsCreating] = useState(false);

  const fetchPipelines = useCallback(async () => {
    try {
      setIsLoadingPipelines(true);
      const pipelines = await PipelineAPI.getPipelines();
      const options: DropdownOption[] = pipelines.map((p: any) => ({
        label: p.PIPELINE_NAME,
        value: p.PIPELINE_ID?.toString(),
      }));
      setPipelineOptions(options);
    } catch (err) {
      console.error('Error fetching pipelines:', err);
      setPipelineOptions([]);
    } finally {
      setIsLoadingPipelines(false);
    }
  }, []);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  const handleBack = () => {
    navigate(ROUTES.RA_COMPLIANCE);
  };

  const isFormValid =
    regulationName.trim() !== '' &&
    selectedPipeline !== '' &&
    regulationType !== '';

  const handleCreate = async () => {
    if (!isFormValid || isCreating) return;

    setIsCreating(true);
    try {
      // Build camelCase payload expected by backend validator
      const payload = {
        regulationName: regulationName.trim(),
        pipelineId: selectedPipeline,
        regulationType: regulationType,
        controlsInput: inputControls?.trim() || undefined,
        // createdBy: 'Mandal, Anupam', // Uncomment if backend requires it
      };

      const compliance = await RAComplianceAPI.createComplianceCheck(payload);

      const id = Number((compliance as any)?.complianceId);
      if (!Number.isNaN(id) && id > 0) {
        navigate(ROUTES.POLICY_SCANNER, {
          state: {
            complianceId: id,
            complianceName : regulationName,
            pipelineId: selectedPipeline,
            regulationType,
            controlsInput: inputControls,
          },
        });
      } else {
        console.error('Failed to create compliance check: Invalid response', compliance);
      }
    } catch (err) {
      console.error('Error creating compliance check:', err);
    } finally {
      setIsCreating(false);
    }
  };

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
        / Regulatory and Audit Agent
      </p>

      <Box className={styles.container}>
        <Box className={styles.headerSection}>
          <Typography variant="h4" className={styles.title}>
            Regulatory and Audit Agent
          </Typography>
          <Typography className={styles.subtitle}>
            AI-powered compliance validation using regulatory documents
          </Typography>
        </Box>

        <Box className={styles.formSection}>
          <Typography className={styles.formTitle}>Create new compliance check</Typography>

          {/* Compliance Name */}
          <Box className={styles.fieldWrapper}>
            <TextField
              fullWidth
              label="Compliance check name"
              value={regulationName}
              onChange={(e) => setRegulationName(e.target.value)}
              className={styles.textField}
              variant="outlined"
            />
            <Box className={styles.helpIconWrapper}>
              <HelpIcon tooltip="Enter a unique name for your compliance check" />
            </Box>
          </Box>

          {/* Pipeline */}
          <Box className={styles.fieldWrapper}>
            <Box className={styles.dropdownContainer}>
              <Dropdown
                label="Select compliance document pipeline.*"
                options={pipelineOptions}
                value={selectedPipeline}
                onChange={(val: string) => setSelectedPipeline(val)}
                placeholder="Select compliance document pipeline.*"
                disabled={isLoadingPipelines}
              />
            </Box>
            <Box className={styles.helpIconWrapper}>
              <HelpIcon tooltip="Choose the compliance document pipeline to validate against" />
            </Box>
          </Box>

          {/* Regulation Type */}
          <Box className={styles.fieldWrapper}>
            <Box className={styles.dropdownContainer}>
              <Dropdown
                label="Select regulations Type"
                options={REGULATION_TYPE_OPTIONS}
                value={regulationType}
                onChange={(val: string) => setRegulationType(val)}
                placeholder="Select regulations Type"
                disabled={isLoadingPipelines}
              />
            </Box>
            <Box className={styles.helpIconWrapper}>
              <HelpIcon tooltip="Choose the regulations type to validate against" />
            </Box>
          </Box>

          {/* Input Controls */}
          <Box className={styles.fieldWrapper}>
            <TextField
              fullWidth
              label="Inputs on controls to be extracted"
              value={inputControls}
              onChange={(e) => setInputControls(e.target.value)}
              className={styles.textField}
              variant="outlined"
            />
            <Box className={styles.helpIconWrapper}>
              <HelpIcon tooltip="Enter the inputs on controls to be extracted" />
            </Box>
          </Box>

          {/* Actions */}
          <Box className={styles.buttonSection}>
            <Button
              variant="outlined"
              onClick={handleBack}
              startIcon={<ArrowBackIcon />}
              className={styles.backButton}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleCreate}
              disabled={!isFormValid || isCreating}
              className={`${styles.createButton} ${!isFormValid ? styles.disabled : ''}`}
            >
              {isCreating ? 'Creating...' : 'Proceed to list Policies​'}
            </Button>
          </Box>
        </Box>
      </Box>
    </div>
  );
};

export default CreateRACompliance;