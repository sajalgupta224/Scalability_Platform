import React, { useCallback, useEffect, useState } from 'react';
import { Box, Typography, TextField, InputAdornment } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import type { DeployedApplication } from '../../types/pages.types';
import styles from './DeployedApplication.module.scss';
import talkToDataSvg from '../../assets/talk-to-data.svg';
import { ChatbotAPI } from '../../api/endpoints/chatbot.api';
import { useChatbot } from '../../context/ChatbotContext';
import { useNavigate } from 'react-router-dom';

const DeployedApplication: React.FC = () => {
  const navigate = useNavigate();
  const { selectChatbot } = useChatbot();
  const [availableDeployedAppllications, setAvailableDeployedApplications] = useState<DeployedApplication[]>([]);
  const [isLoadingDeployedApplications, setIsLoadingDeployedApplications] = useState(false);
  const [deployedApplicationsError, setDeployedApplicationsError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');

  const fetchDeployedApplications = useCallback(async () => {
    setIsLoadingDeployedApplications(true);
    setDeployedApplicationsError(null);
    try {
      const deployedApps = await ChatbotAPI.getDeployedApplications();
      const chatbotsList: DeployedApplication[] = deployedApps.map((item) => ({
        id: item.CHATBOT_ID?.toString() || item.ID?.toString() || '',
        name: item.CHATBOT_NAME || item.NAME || '',
      }));
      setAvailableDeployedApplications(chatbotsList);
    } catch (err) {
      console.error('Error fetching deployed applications:', err);
      setDeployedApplicationsError('Failed to load deployed applications');
      setAvailableDeployedApplications([]);
    } finally {
      setIsLoadingDeployedApplications(false);
    }
  }, []);

  useEffect(() => {
    fetchDeployedApplications();
    if (deployedApplicationsError) {
      console.log(deployedApplicationsError);
    }
  }, [fetchDeployedApplications]);

  // Filter deployed applications based on search query
  const filteredDeployedApplications = availableDeployedAppllications.filter((availableDeployedAppllication) =>
      availableDeployedAppllication.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeployedApplicationSelect = async (deployedApplication: any) => {
    if (deployedApplication) {
      // Update context with selected chatbot (will fetch full chatbot data)
      await selectChatbot(deployedApplication);

      navigate('/experimentation', { state: { from: 'deployed' } });
    }
  };

  return (
    <Box className={styles.container}>
      {/* Header */}
      <Box className={styles.headerSection}>
        <Typography variant="h4" className={styles.title}>
          Deployed Application
        </Typography>
      </Box>

      {/* Search and Create Section */}
      <Box className={styles.searchSection}>
        <TextField
          fullWidth
          placeholder="Search Deployed Application"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={styles.searchInput}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon className={styles.searchIcon} />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Chatbot Cards Grid */}
      <Box className={styles.cardsGrid}>
        {isLoadingDeployedApplications ? (
          <Typography>Loading deployed application...</Typography>
        ) : filteredDeployedApplications.length === 0 ? (
          <Typography className={styles.noResults}>No Deployed Application found</Typography>
        ) : (
          filteredDeployedApplications.map((deployedApplication) => (
            <Box
              key={deployedApplication.id}
              className={styles.card}
              onClick={() => handleDeployedApplicationSelect(deployedApplication)}
            >
              <Box className={styles.cardImage}>
                <img src={talkToDataSvg} alt={deployedApplication.name} />
              </Box>
              <Box className={styles.cardContent}>
                <Typography variant="h6" className={styles.cardTitle}>
                  {deployedApplication.name}
                </Typography>
                <Typography variant="body2" className={styles.cardDescription}>
                  {
                    'Ask questions in plain English, and get instant answers from your data - no coding needed.'
                  }
                </Typography>
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};

export default DeployedApplication;
