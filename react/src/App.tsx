import { Suspense } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import AppRoutes from './routes';
import Layout from './layout/Layout';
import { AppProvider } from './context/AppContext';
import { NotificationProvider } from './context/NotificationContext';
import { ChatbotProvider } from './context/ChatbotContext';
import Loader from './components/common/Loader/Loader';
import { ErrorBoundary } from './components/common/ErrorBoundary/ErrorBoundary';
import { getTheme } from './theme';

const App = () => {
    const theme = getTheme('light');
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <AppProvider>
            <NotificationProvider>
              <ChatbotProvider>
                <Layout>
                  <Suspense fallback={<Loader />}>
                    <AppRoutes />
                  </Suspense>
                </Layout>
              </ChatbotProvider>
            </NotificationProvider>
          </AppProvider>
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
