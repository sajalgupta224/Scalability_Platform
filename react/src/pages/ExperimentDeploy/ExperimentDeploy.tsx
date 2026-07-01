
import React, { useState } from 'react';
import { Box, Typography, TextField, Button, InputAdornment } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import styles from './ExperimentDeploy.module.scss';
import bankingBotImg from '../../assets/banking-bot.svg';

// Mock data for cards
const mockBots = [
  {
    name: 'Banking bot',
    pipeline: 'Pipeline_name',
    created: '17th November 2025 at 17:15',
    image: bankingBotImg,
  },
  {
    name: 'Revenue bot',
    pipeline: 'Pipeline_name',
    created: '17th November 2025 at 17:15',
    image: bankingBotImg,
  },
  {
    name: 'Finance bot',
    pipeline: 'Pipeline_name',
    created: '17th November 2025 at 17:15',
    image: bankingBotImg,
  },
  {
    name: 'Banking bot 1',
    pipeline: 'Pipeline_name',
    created: '17th November 2025 at 17:15',
    image: bankingBotImg,
  },
  {
    name: 'Banking bot 2',
    pipeline: 'Pipeline_name',
    created: '17th November 2025 at 17:15',
    image: bankingBotImg,
  },
  // Add more if needed
];

const PAGE_SIZE = 5;

const ExperimentDeploy: React.FC = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  // Filtered and paginated bots
  const filteredBots = mockBots.filter(bot =>
    bot.name.toLowerCase().includes(search.toLowerCase())
  );
  const totalResults = filteredBots.length;
  const totalPages = Math.ceil(totalResults / PAGE_SIZE);
  const paginatedBots = filteredBots.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCreate = () => {
    // Navigate to create new bot page (adjust route as needed)
    navigate('/create-chatbot');
  };

  return (
    <Box className={styles.container}>
      {/* Breadcrumb */}
      <Box className={styles.breadcrumb}>
        <Typography component="span" color="primary" style={{ cursor: 'pointer' }} onClick={() => navigate('/application')}>
          Application
        </Typography>
        <span style={{ margin: '0 8px' }}>/</span>
        <Typography component="span" color="textSecondary">
          Experiment and Deploy
        </Typography>
      </Box>

      {/* Header */}
      <Typography variant="h4" className={styles.title} gutterBottom>
        Experiment and Deploy
      </Typography>
      <Typography variant="body1" className={styles.subtitle} gutterBottom>
        Experiment or search the existing ones.
      </Typography>

      {/* Search and Create */}
      <Box className={styles.searchSection}>
        <TextField
          fullWidth
          placeholder="Search chatbot..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
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
          onClick={handleCreate}
          className={styles.createButton}
        >
          Create new
        </Button>
      </Box>

      {/* Results count */}
      <Typography className={styles.resultsCount}>
        Showing <b>{totalResults}</b> results
      </Typography>

      {/* Cards grid */}
      <Box className={styles.cardsGrid}>
        {paginatedBots.map((bot, idx) => (
          <Box key={idx} className={styles.card}>
            <Box className={styles.cardImage}>
              <img src={bot.image} alt={bot.name} />
            </Box>
            <Box className={styles.cardContent}>
              <Typography variant="h6" className={styles.cardTitle}>{bot.name}</Typography>
              <Typography variant="body2" className={styles.cardDescription}>
                <b>Pipeline:</b> {bot.pipeline}<br />
                <b>Date created:</b> {bot.created}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      {/* Pagination */}
      {totalPages > 1 && (
        <Box className={styles.pagination}>
          <Button
            onClick={() => setPage(page - 1)}
            disabled={page === 1}
            className={styles.pageButton}
          >
            {'<'}
          </Button>
          {[...Array(totalPages)].map((_, i) => (
            <Button
              key={i}
              onClick={() => setPage(i + 1)}
              className={styles.pageButton + ' ' + (page === i + 1 ? styles.activePage : '')}
              variant={page === i + 1 ? 'contained' : 'outlined'}
            >
              {i + 1}
            </Button>
          ))}
          <Button
            onClick={() => setPage(page + 1)}
            disabled={page === totalPages}
            className={styles.pageButton}
          >
            {'>'}
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default ExperimentDeploy;