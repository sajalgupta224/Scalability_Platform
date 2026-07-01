import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, InputAdornment, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import type { RAComplianceOption } from '../../types/racompliance.types';
import styles from './RACompliance.module.scss';
import raComplianceCard from '../../assets/ra-compliance.svg';
import AddIcon from '@mui/icons-material/Add';
import { useNavigate } from 'react-router-dom';
import { RAComplianceAPI } from '../../api/endpoints/racompliance.api';
import { ROUTES } from '../../constants';

const formatCreatedDate = (dateString: string): string => {
  const date = new Date(dateString);
  const day = date.getDate();
  const month = date.toLocaleString('en-US', { month: 'long' });
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  const getOrdinalSuffix = (n: number): string => {
    if (n > 3 && n < 21) {
      return 'th';
    }
    switch (n % 10) {
      case 1:
        return 'st';
      case 2:
        return 'nd';
      case 3:
        return 'rd';
      default:
        return 'th';
    }
  };

  return `${day}${getOrdinalSuffix(day)} ${month} ${year} at ${hours}:${minutes}`;
};

const RACompliance: React.FC = () => {
  const [availableCompliances, setAvailableCompliances] = useState<RAComplianceOption[]>([]);
  const [isLoadingCompliances, setIsLoadingCompliances] = useState(false);
  const [compliancesError, setCompliancesError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCompliances = useCallback(async () => {
    setIsLoadingCompliances(true);
    setCompliancesError(null);
    try {
      const compliances = await RAComplianceAPI.getCompliances();
      const compliancesList: RAComplianceOption[] = compliances.map((item) => ({
        id: item.REGULATION_ID?.toString(),
        name: item.REGULATION_NAME,
        createdAt: item.CREATED_AT,
      }));
      setAvailableCompliances(compliancesList);
    } catch (err) {
      console.error('Error fetching compliances:', err);
      setCompliancesError('Failed to load compliances');
      setAvailableCompliances([]);
    } finally {
      setIsLoadingCompliances(false);
    }
  }, []);

  useEffect(() => {
    fetchCompliances();
  }, [fetchCompliances]);

  const handleCreateNewCompliance = () => {
    navigate(ROUTES.CREATE_RA_COMPLIANCE);
  };

  // Filter compliances based on search query
  const filteredCompliances = availableCompliances.filter((compliance) =>
    compliance.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleComplianceSelect = (compliance: RAComplianceOption) => {
    // Navigate to view compliance page with compliance ID
    navigate(`${ROUTES.VIEW_RA_COMPLIANCE}/${compliance.id}`);
  };

  return (
    <div className={styles.graywrapper} style={{ backgroundColor: '#ffffff' }}>
      <h3 className={styles.wrappertitle}>Application</h3>

      <p className={styles.wrapperdesc}>Regulatory & Audit Compliance</p>

      <Box className={styles.container}>
        {/* Header */}

        <Box className={styles.headerSection}>
          <Typography variant="h5" className={styles.title}>
            Regulatory & Audit Compliance
          </Typography>
          <p className={styles.wrapperdesc}>Create new compliance or search the existing ones.</p>
        </Box>

        {/* Search and Create Section */}
        <Box className={styles.searchSection}>
          <TextField
            fullWidth
            placeholder="Search compliance..."
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
            onClick={handleCreateNewCompliance}
            className={styles.createButton}
          >
            Create new
          </Button>
        </Box>

        {/* Compliance Cards Grid */}
        <Box className={styles.cardsGrid}>
          {compliancesError ? (
            <Typography className={styles.errorMessage} color="error">
              {compliancesError}
            </Typography>
          ) : isLoadingCompliances ? (
            <Typography>Loading compliance...</Typography>
          ) : filteredCompliances.length === 0 ? (
            <Typography className={styles.noResults}>No Compliance found</Typography>
          ) : (
            filteredCompliances.map((compliance) => (
              <Box
                key={compliance.id}
                className={styles.card}
                onClick={() => handleComplianceSelect(compliance)}
              >
                <Box className={styles.cardImage}>
                  <img src={compliance.imageUrl || raComplianceCard} alt={compliance.name} />
                </Box>
                <Box className={styles.cardContent}>
                  <Typography variant="h6" className={styles.cardTitle}>
                    {compliance.name}
                  </Typography>
                  <Typography variant="body2" className={styles.cardDescription}>
                    Date created: <br />
                    {compliance.createdAt ? formatCreatedDate(compliance.createdAt) : 'N/A'}
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

export default RACompliance;
