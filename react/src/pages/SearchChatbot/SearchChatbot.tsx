import React, { useState } from 'react';
import { Box, Typography, TextField, Button, InputAdornment } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import styles from './SearchChatbot.module.scss';
import { useChatbot } from '../../context/ChatbotContext';
import { useAppContext } from '../../context/AppContext';
import type { ChatbotOption } from '../../types/chatbot';
import chatbotOne from '../../assets/chatbots/chatbot-1.svg';

const SearchChatbot: React.FC = () => {
  const navigate = useNavigate();
  const { availableChatbots, isLoadingChatbots, selectChatbot, clearChatbotData } = useChatbot();
  const { mode } = useAppContext();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter chatbots based on search query
  const filteredChatbots = availableChatbots.filter((chatbot) =>
    chatbot.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateChatbot = () => {
    clearChatbotData();
    navigate('/experimentation', { state: { createNew: true, from: 'experiment', mode } });
  };

  const handleChatbotSelect = async (chatbotOption: ChatbotOption | null) => {
    if (chatbotOption) {
      // Update context with selected chatbot (will fetch full chatbot data)
      await selectChatbot(chatbotOption);

      // Navigate to Experimentation with chatbot ID and mode in URL
      navigate(`/experimentation/${chatbotOption.id}?mode=${mode}`, { state: { from: 'experiment' } });
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box className={styles.headerSection}>
        <Typography variant="h3" className={styles.title}>
          Experimentation and Deployment
        </Typography>
        <Typography variant="body1" className={styles.subtitle}>
          Create new bot or search the existing ones.
        </Typography>
      </Box>

      {/* Search and Create Section */}
      <Box className={styles.searchSection}>
        <TextField
          fullWidth
          placeholder="Search Chatbot name"
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
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateChatbot}
          className={styles.createButton}
        >
          Create new Chatbot
        </Button>
      </Box>

      {/* Chatbot Cards Grid */}
      <Box className={styles.cardsGrid}>
        {isLoadingChatbots ? (
          <Typography>Loading chatbots...</Typography>
        ) : filteredChatbots.length === 0 ? (
          <Typography className={styles.noResults}>No chatbots found</Typography>
        ) : (
          filteredChatbots.map((chatbot) => (
            <Box
              key={chatbot.id}
              className={styles.card}
              onClick={() => handleChatbotSelect(chatbot)}
            >
              <Box className={styles.cardImage}>
                <img src={chatbot.imageUrl || chatbotOne} alt={chatbot.name} />
              </Box>
              <Box className={styles.cardContent}>
                <Typography variant="h6" className={styles.cardTitle}>
                  {chatbot.name}
                </Typography>
                <Typography variant="body2" className={styles.cardDescription}>
                  {chatbot.description ||
                    'Ask questions in plain English, and get instant answers from your data - no coding needed.'}
                </Typography>
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};

export default SearchChatbot;
