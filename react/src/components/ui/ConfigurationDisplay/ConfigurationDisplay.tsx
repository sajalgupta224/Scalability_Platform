import React from 'react';
import { Box, Typography } from '@mui/material';
import ConfigurationTable from './ConfigurationTable';
import type { ConfigurationRow } from '../../../types/pipeline';
import styles from './ConfigurationDisplay.module.scss';

interface ConfigurationDisplayProps {
  title: string;
  rows: ConfigurationRow[];
}

const ConfigurationDisplay: React.FC<ConfigurationDisplayProps> = ({ title, rows }) => {
  return (
    <Box className={styles.section}>
      <Typography variant="subtitle1" className={styles.sectionTitle}>
        {title}
      </Typography>
      <ConfigurationTable rows={rows} />
    </Box>
  );
};

export default ConfigurationDisplay;
