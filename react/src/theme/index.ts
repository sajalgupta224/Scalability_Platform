import { createTheme } from '@mui/material/styles';

export const getTheme = (mode: 'light' | 'dark') =>
  createTheme({
    palette: { 
      mode, 
      // text: { primary: '#000', secondary: '#fff' }, 
      // success: { main: '#28a745' }, 
      // warning: { main: '#ffc107' }, 
      // error: { main: '#dc3545' } 
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif'
    }
  });
