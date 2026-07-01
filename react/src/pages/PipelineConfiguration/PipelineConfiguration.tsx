import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import FormatSizeOutlinedIcon from '@mui/icons-material/FormatSizeOutlined';
import SettingsOverscanOutlinedIcon from '@mui/icons-material/SettingsOverscanOutlined';
import TableChartOutlinedIcon from '@mui/icons-material/TableChartOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import type { ConfigurationRow, PipelineConfigResponse } from '../../types/pipeline';
import { ROUTES } from '../../constants';
import styles from './PipelineConfiguration.module.scss';
import ConfigurationDisplay from '../../components/ui/ConfigurationDisplay/ConfigurationDisplay';
import { PipelineAPI } from '../../api/endpoints/pipeline.api';
import { SchemaOutlined, SettingsOutlined, StorageOutlined } from '@mui/icons-material';

const PipelineConfiguration: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configData, setConfigData] = useState<PipelineConfigResponse | null>(null);

  useEffect(() => {
    const fetchPipelineConfiguration = async () => {
      if (!id) {
        setError('Pipeline ID is missing');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const PipelineConfigurationData = await PipelineAPI.getPipelineConfiguration(id);
        setConfigData(PipelineConfigurationData);
      } catch (err) {
        console.error('Error fetching pipeline configuration:', err);
        setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchPipelineConfiguration();
  }, [id]);

  const handleBack = () => {
    navigate(ROUTES.DATA_PREPARATION);
  };

  const handleEdit = () => {
    if (id) {
      navigate(`${ROUTES.EDIT_PIPELINE}/${id}`);
    }
  };

  // Loading state
  if (loading) {
    return (
      <Box className={styles.loadingContainer}>
        <CircularProgress />
        <Typography variant="body1" sx={{ marginTop: 2 }}>
          Loading pipeline configuration...
        </Typography>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box className={styles.errorContainer}>
        <Typography variant="h6" color="error" sx={{ marginBottom: 2 }}>
          {error}
        </Typography>
        <Button variant="contained" onClick={handleBack} startIcon={<ArrowBackIcon />}>
          Back to Data Preparation
        </Button>
      </Box>
    );
  }

  // No data state
  if (!configData) {
    return (
      <Box className={styles.errorContainer}>
        <Typography variant="h6" sx={{ marginBottom: 2 }}>
          No configuration data available
        </Typography>
        <Button variant="contained" onClick={handleBack} startIcon={<ArrowBackIcon />}>
          Back to Data Preparation
        </Button>
      </Box>
    );
  }

  const commonpipelineConfigRows: ConfigurationRow[] = [
    {
      field: 'Data pipeline name',
      value: configData?.pipelineConfiguration?.dataPipelineName || '-',
      icon: <AccountTreeOutlinedIcon />,
    },
    {
      field: 'File source type',
      value: configData?.pipelineConfiguration?.fileSourceType || '-',
      icon: <CloudOutlinedIcon />,
    },
  ];

  const uploadPipelineConfigRows: ConfigurationRow[] = [
    {
      field: 'File location',
      value: configData?.pipelineConfiguration?.fileLocation || '-',
      icon: <FolderOutlinedIcon />,
    },
    {
      field: 'File type',
      value: configData?.pipelineConfiguration?.fileType || '-',
      icon: <DescriptionOutlinedIcon />,
    },
  ];

  const chunkingDetailsRows: ConfigurationRow[] = [
    {
      field: 'Chunking method',
      value: configData?.chunkingDetails?.chunkingMethod || '-',
      icon: <ViewColumnOutlinedIcon />,
    },
    {
      field: 'Chunking size',
      value: configData.chunkingDetails?.chunkingSize || '-',
      icon: <FormatSizeOutlinedIcon />,
    },
    {
      field: 'Chunk overlap',
      value: configData?.chunkingDetails?.chunkOverlap || '-',
      icon: <SettingsOverscanOutlinedIcon />,
    },
    {
      field: 'Chunk table',
      value: configData?.chunkingDetails?.chunkTable || '-',
      icon: <TableChartOutlinedIcon />,
    },
    {
      field: 'Cortex search service',
      value: configData?.chunkingDetails?.cortexSearchService || '-',
      icon: <SearchOutlinedIcon />,
    },
  ];

  const databaseDetailsRows: ConfigurationRow[] = [
    {
      field: 'Selected database',
      value: configData?.databaseDetails?.selectedDb || '-',
      icon: <StorageOutlined />,
    },
    {
      field: 'Selected schema',
      value: configData?.databaseDetails?.selectedSchema || '-',
      icon: <SchemaOutlined />,
    },
    {
      field: 'Semantic option',
      value:
        configData?.databaseDetails?.semanticView ||
        configData?.databaseDetails?.semanticModel ||
        '-',
      icon: <SettingsOutlined />,
    },
  ];

  const pipelineConfigRows: ConfigurationRow[] = [
    ...commonpipelineConfigRows,
    ...(configData?.pipelineConfiguration?.fileSourceType === 'cloud'
      ? uploadPipelineConfigRows
      : []),
  ];

  const pipelineAdditionalRows: ConfigurationRow[] = [
    ...(configData?.pipelineConfiguration?.fileSourceType === 'cloud' ? chunkingDetailsRows : []),
    ...(configData?.pipelineConfiguration?.fileSourceType === 'database'
      ? databaseDetailsRows
      : []),
  ];

  const pipelineAdditionalRowsTitle: string =
    configData?.pipelineConfiguration?.fileSourceType === 'cloud'
      ? 'Chunking details'
      : 'Database details';

  return (
    <Box className={styles.pageContainer}>
      <Box className={styles.contentCard}>
        {/* Header */}
        <Box className={styles.header}>
          <Typography variant="h5" className={styles.title}>
            Data pipeline configuration
          </Typography>
          <Typography variant="body2" className={styles.subtitle}>
            Take a quick look at your pipeline details to make sure everything looks good before
            moving forward.
          </Typography>
        </Box>

        {/* Pipeline Configuration Section */}
        <ConfigurationDisplay title="Pipeline configuration" rows={pipelineConfigRows} />

        {/* Chunking Details Section */}
        <ConfigurationDisplay title={pipelineAdditionalRowsTitle} rows={pipelineAdditionalRows} />

        {/* Action Buttons */}
        <Box className={styles.actionButtons}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            onClick={handleBack}
            className={styles.backButton}
          >
            Back
          </Button>
          <Button
            variant="contained"
            startIcon={<EditOutlinedIcon />}
            onClick={handleEdit}
            className={styles.editButton}
          >
            Edit
          </Button>
        </Box>
      </Box>
    </Box>
  );
};

export default PipelineConfiguration;
