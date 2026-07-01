import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface LoaderProps {
  message?: string;
  size?: number;
}

const Loader: React.FC<LoaderProps> = ({ message = 'Loading...', size = 48 }) => {
  return (
    <Box
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      height="100%"
      width="100%"
      sx={{ py: 4 }}
    >
      <CircularProgress size={size} />
      {message && (
        <Typography variant="body1" sx={{ mt: 2 }}>
          {message}
        </Typography>
      )}
    </Box>
  );
};

export default Loader;