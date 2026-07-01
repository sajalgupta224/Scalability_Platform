import React from 'react';
import { Box, LinearProgress, Typography } from '@mui/material';

interface UploadProgressProps {
  fileName: string;
  progress: number; // 0-100, -1 for failed
}

const UploadProgress: React.FC<UploadProgressProps> = ({ fileName, progress }) => {
  return (
    <Box mb={2}>
      <Typography>{fileName}</Typography>
      {progress === -1 ? (
        <Typography color="error">Upload failed</Typography>
      ) : (
        <>
          <LinearProgress variant="determinate" value={progress} sx={{ mt: 1 }} />
          <Typography variant="body2">{progress}%</Typography>
        </>
      )}
    </Box>
  );
};

export default UploadProgress;