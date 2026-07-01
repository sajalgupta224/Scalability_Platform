
import React, { useCallback, useEffect, useState } from 'react';
import { Box, Typography, TextField, InputAdornment, Button } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import type { PipelineOption } from '../../types/chatbot';
import styles from './DataPreparation.module.scss';
import pipelineCard from '../../assets/pipeline-card.svg';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import { PipelineAPI } from '../../api/endpoints/pipeline.api';
import { ROUTES } from '../../constants';
import { useAppContext } from '../../context/AppContext';
import { getModeDisplay } from '../Application/Application';

const DataPreparation: React.FC = () => {
  const [availableDataPreparations, setAvailableDataPreparations] = useState<PipelineOption[]>([]);
  const [isLoadingDataPreparations, setIsLoadingDataPreparations] = useState(false);
  const [dataPreparationsError, setDataPreparationsError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { mode } = useAppContext();

  console.log("🔵 UI Loaded | Current Mode from Context:", mode);

  const fetchDataPreparations = useCallback(async () => {
    console.log("📡 Fetching pipelines with mode:", mode);

    setIsLoadingDataPreparations(true);
    setDataPreparationsError(null);

    try {
      const pipelines = await PipelineAPI.getPipelines(mode || undefined);
      console.log("🟢 API Response - Pipelines:", pipelines);

      const pipelinesList: PipelineOption[] = pipelines.map((item) => ({
        id: item.PIPELINE_ID.toString(),
        name: item.PIPELINE_NAME,
      }));

      console.log("🟩 Mapped Pipelines List:", pipelinesList);

      setAvailableDataPreparations(pipelinesList);
    } catch (err) {
      console.error('🔴 Error fetching pipelines:', err);
      setDataPreparationsError('Failed to load pipelines');
      setAvailableDataPreparations([]);
    } finally {
      setIsLoadingDataPreparations(false);
    }
  }, [mode]);

  useEffect(() => {
    console.log("🔁 useEffect triggered | Fetch pipelines");
    fetchDataPreparations();
  }, [fetchDataPreparations]);

  const handleCreateNewPipeline = () => {
    console.log("🆕 Create New Pipeline Clicked");
    navigate(ROUTES.CREATE_PIPELINE);
  };

  const handleDataPreparationSelect = async (dataPreparation: PipelineOption) => {
    console.log("📄 Pipeline Selected:", dataPreparation);
    navigate(`${ROUTES.PIPELINE_CONFIGURATION}/${dataPreparation.id}`);
  };

  const filteredDataPreparations = availableDataPreparations.filter((availableDataPreparation) =>
    availableDataPreparation.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  console.log("🔍 Search Query:", searchQuery);
  console.log("🔎 Filtered Pipelines:", filteredDataPreparations);

  return (
    <div className={styles.graywrapper} style={{ backgroundColor: '#F5F6FA;' }}>
      <h3 className={styles.wrappertitle}>Application</h3>

      <p className={styles.wrapperdesc}>
        <span style={{ color: 'blue' }}>{getModeDisplay(mode)}</span> / Data Preparation
      </p>

      <Box className={styles.container}>
        {/* Header */}
        <Box className={styles.headerSection}>
          <Typography variant="h5" className={styles.title}>
            Data Preparation
          </Typography>
          <p className={styles.wrapperdesc}>
            PREPARE YOUR DATA FOR ANALYSIS.
          </p>
        </Box>

        {/* Search + Create Button */}
        <Box className={styles.searchSection}>
          <TextField
            fullWidth
            placeholder="Search Pipeline"
            value={searchQuery}
            onChange={(e) => {
              console.log("⌨️ Typing in search:", e.target.value);
              setSearchQuery(e.target.value);
            }}
            className={styles.searchInput}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon className={styles.searchIcon} />
                </InputAdornment>
              ),
            }}
          />

          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreateNewPipeline}
            className={styles.createButton}
          >
            Create new Pipeline
          </Button>
        </Box>

        {/* Pipeline Cards */}
        <Box className={styles.cardsGrid}>
          {dataPreparationsError ? (
            <Typography className={styles.errorMessage} color="error">
              {dataPreparationsError}
            </Typography>
          ) : isLoadingDataPreparations ? (
            <Typography>Loading data preparation...</Typography>
          ) : filteredDataPreparations.length === 0 ? (
            <Typography className={styles.noResults}>No Data Preparation found</Typography>
          ) : (
            filteredDataPreparations.map((dataPreparation) => (
              <Box
                key={dataPreparation.id}
                className={styles.card}
                onClick={() => handleDataPreparationSelect(dataPreparation)}
              >
                <Box className={styles.cardImage}>
                  <img src={dataPreparation.imageUrl || pipelineCard} alt={dataPreparation.name} />
                </Box>
                <Box className={styles.cardContent}>
                  <Typography variant="h6" className={styles.cardTitle}>
                    {dataPreparation.name}
                  </Typography>
                  <Typography variant="body2" className={styles.cardDescription}>
                    {dataPreparation.description ||
                      'Ask questions in plain English, and get instant answers from your data - no coding needed.'}
                  </Typography>
                </Box>
              </Box>
            ))
          )}
        </Box>
      </Box>
    </div>
  );
};

export default DataPreparation;
