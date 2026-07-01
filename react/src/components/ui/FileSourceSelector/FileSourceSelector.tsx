// src/components/ui/FileSourceSelector/FileSourceSelector.tsx
import React from 'react';
import { Box, FormControlLabel, Radio, RadioGroup, Typography } from '@mui/material';
import CloudOutlinedIcon from '@mui/icons-material/CloudOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import type { FileSourceType } from '../../../types/dataPreparation';
import { useAppContext } from '../../../context/AppContext';
import styles from './FileSourceSelector.module.scss';

interface FileSourceSelectorProps {
  value: FileSourceType | null;
  onChange: (value: FileSourceType) => void;
  error?: string;
}

const FileSourceSelector: React.FC<FileSourceSelectorProps> = ({ value, onChange, error }) => {
  const { mode } = useAppContext();

  return (
    <Box className={styles.container}>
      <Typography className={styles.title}>Source type *</Typography>

      <RadioGroup
        row
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value as FileSourceType)}
        className={styles.radioGroup}
      >
        {/* Cloud storage card */}
        <FormControlLabel
          value="cloud"
          control={<Radio className={styles.radio} />}
          className={`${value === 'cloud' ? styles.cardSelected : styles.cardBase} ${mode === 'TalkToData' ? styles.cardHidden : ''}`}
          label={
            <Box className={styles.cardBody}>
              <Box className={styles.iconCircle}>
                <CloudOutlinedIcon />
              </Box>
              <Box className={styles.labelTextWrapper}>
                <span className={styles.labelText}>Cloud storage</span>
                <span className={styles.labelDescription}>Ingest data from files stored in cloud storage.</span>
              </Box>
            </Box>
          }
          componentsProps={{
            typography: {
              component: 'div',
              className: styles.labelContent,
            },
          }}
        />

        {/* Database card */}
        <FormControlLabel
          value="database"
          control={<Radio className={styles.radio} />}
          className={value === 'database' ? styles.cardSelected : styles.cardBase}
          label={
            <Box className={styles.cardBody}>
              <Box className={styles.iconCircle}>
                <StorageOutlinedIcon />
              </Box>
              <Box className={styles.labelTextWrapper}>
                <span className={styles.labelText}>Database</span>
                <span className={styles.labelDescription}>Ingest data from a database using structured queries.</span>
              </Box>
            </Box>
          }
          componentsProps={{
            typography: {
              component: 'div',
              className: styles.labelContent,
            },
          }}
        />
      </RadioGroup>

      {error && (
        <Typography color="error" className={styles.errorText}>
          {error}
        </Typography>
      )}
    </Box>
  );
};

export default FileSourceSelector;
