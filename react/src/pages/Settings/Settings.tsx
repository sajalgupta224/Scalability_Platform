import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Alert,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Typography,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import EmailIcon from '@mui/icons-material/Email';
import PolicyIcon from '@mui/icons-material/Policy';
import { ModelsAPI } from '../../api/endpoints/models.api';
import { MAX_SELECTED_MODELS } from '../../constants/models';
import styles from './Settings.module.scss';
import DailySummarySettings from "./DailySummarySettings";
 
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}
 
function TabPanel(props: TabPanelProps) {
  const { children, value, index } = props;
 
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`settings-tabpanel-${index}`}
      aria-labelledby={`settings-tab-${index}`}
      style={{ height: '100%' }}
    >
      {value === index && (
        <Box
          sx={{
            ...contentGutters,
            pt: 2,
            pb: 2,
            m: 0,
            height: '100%',
          }}
        >
          {children}
        </Box>
      )}
    </div>
  );
}
 
/** Shared responsive gutters */
const contentGutters = {
  px: { xs: 2, sm: 3, md: 4, lg: 6 },
};
 
const Settings: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [notificationEmail, setNotificationEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
 
  // Persisted selected models used as defaults across chatbots. Stored in localStorage
  const [selectedModels, setSelectedModels] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem('selectedModels');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
 
  const toggleModel = (model: string) => {
    setSelectedModels((prev) => {
      const isAdding = !prev.includes(model);
      if (isAdding && prev.length >= MAX_SELECTED_MODELS) {
        setMessage({
          type: 'error',
          text: `You can select maximum ${MAX_SELECTED_MODELS} models.`,
        });
        return prev;
      }
 
      const next = prev.includes(model) ? prev.filter((m) => m !== model) : [...prev, model];
      try {
        window.localStorage.setItem('selectedModels', JSON.stringify(next));
        // Notify other parts of the app that models changed so they can react (if they listen)
        window.dispatchEvent(new Event('selectedModelsChanged'));
      } catch (e) {
        // ignore storage errors
      }
      return next;
    });
  };
 
  const handleSaveEmail = async () => {
    if (!notificationEmail) {
      setMessage({ type: 'error', text: 'Please enter an email address' });
      return;
    }
 
    setLoading(true);
    try {
      const response = await fetch('http://localhost:5000/api/update_procedure_email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: notificationEmail }),
      });
 
      const data = await response.json();
      if (response.ok) {
        setMessage({ type: 'success', text: 'Email saved and verification sent' });
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save email' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setLoading(false);
    }
  };
 
  // Load all available models from backend so Settings shows full set (not a hardcoded list)
  useEffect(() => {
    let ignore = false;
 
    const load = async () => {
      try {
        const models = await ModelsAPI.getModels();
        if (ignore) return;
        setAvailableModels(models);
 
        // If selectedModels contains values that are no longer available, trim them
        setSelectedModels((prev) => {
          const next = (prev || []).filter((m) => models.includes(m));
          try {
            window.localStorage.setItem('selectedModels', JSON.stringify(next));
          } catch {}
          return next;
        });
      } catch (err) {
        console.error('Failed to load models in Settings:', err);
        if (!ignore) setAvailableModels([]);
      }
    };
 
    load();
    return () => {
      ignore = true;
    };
  }, []);
 
  return (
    <Box
      className={styles.page}
      sx={{
        p: 0,
        m: 0,
        width: '100%',
        height: '100%',
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        backgroundColor: 'transparent',
      }}
    >
      <Box sx={{ ...contentGutters, pt: 2, pb: 1 }}>
        <h1 style={{ margin: 0 }}>Settings</h1>
        <p style={{ color: '#666', marginTop: 8, marginBottom: 0 }}>
          Manage application configuration and notifications
        </p>
      </Box>
 
      {message && (
        <Alert
          severity={message.type}
          sx={{ ...contentGutters, my: 1 }}
          onClose={() => setMessage(null)}
        >
          {message.text}
        </Alert>
      )}
 
      <Paper
        sx={{
          flex: 1,
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          bgcolor: '#fff',
        }}
      >
        <Box
          sx={{
            ...contentGutters,
            bgcolor: '#fff',
            borderBottom: 1,
            borderColor: 'divider',
          }}
        >
          <Tabs
            value={tabValue}
            onChange={(_e, newValue) => setTabValue(newValue)}
            sx={{
              p: 0,
              minHeight: 48,
              bgcolor: 'transparent',
              '& .MuiTabs-flexContainer': { pl: 0 },
            }}
            TabIndicatorProps={{ sx: { height: 2, left: 0 } }}
          >
            <Tab
              label="Email Notifications"
              id="settings-tab-0"
              aria-controls="settings-tabpanel-0"
              sx={{ px: 0, minWidth: 0, minHeight: 48, textTransform: 'none', fontWeight: 500 }}
            />
            <Tab
              label="List of Policies"
              id="settings-tab-1"
              aria-controls="settings-tabpanel-1"
              sx={{ px: 2, minWidth: 0, minHeight: 48, textTransform: 'none', fontWeight: 500 }}
            />
            <Tab
              label="Choose Models"
              id="settings-tab-2"
              aria-controls="settings-tabpanel-2"
              sx={{ px: 2, minWidth: 0, minHeight: 48, textTransform: 'none', fontWeight: 500 }}
            />
            <Tab
              label="Email Automation"
              id="settings-tab-3"
              aria-controls="settings-tabpanel-2"
              sx={{ px: 2, minWidth: 0, minHeight: 48, textTransform: 'none', fontWeight: 500 }}
            />
          </Tabs>
        </Box>
 
        {/* Tab 0: Email Notifications */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ width: '100%', height: '100%', maxWidth: 1200 }}>
            <Card elevation={0} sx={{ bgcolor: '#f9f9f9', width: '100%', p: 2 }}>
              <CardHeader
                avatar={<EmailIcon sx={{ color: '#1976d2' }} />}
                title="Notification Email Configuration"
                subheader="Configure where error notifications will be sent"
              />
              <Divider />
              <CardContent sx={{ p: 2 }}>
                <Alert severity="info" sx={{ mb: 2 }}>
                  Set up an email address to receive error notifications from the AI Scalability Platform.
                  A verification email will be sent to confirm your address.
                </Alert>
 
                <TextField
                  label="Notification Email Address"
                  type="email"
                  fullWidth
                  value={notificationEmail}
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  placeholder="your-email@example.com"
                  sx={{ mb: 2 }}
                  disabled={loading}
                />
 
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={handleSaveEmail}
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : 'Save & Send Verification'}
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Box>
        </TabPanel>
 
        {/* Tab 1: Policies */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ width: '100%', height: '100%', maxWidth: 1200 }}>
            <Card
              elevation={0}
              sx={{
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: '#fff',
              }}
            >
              <CardHeader
                avatar={<PolicyIcon color="primary" />}
                title="Policy Types"
                subheader="Review the core governance and compliance categories"
                sx={{ pb: 0 }}
              />
              <CardContent sx={{ pt: 0 }}>
                <List dense>
                  <ListItem>
                    <ListItemIcon>
                      <PolicyIcon sx={{ color: 'text.secondary' }} />
                    </ListItemIcon>
                    <ListItemText primary="1. Access Management" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <PolicyIcon sx={{ color: 'text.secondary' }} />
                    </ListItemIcon>
                    <ListItemText primary="2. Data Security & Protection" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <PolicyIcon sx={{ color: 'text.secondary' }} />
                    </ListItemIcon>
                    <ListItemText primary="3. Classification & PII Identification" />
                  </ListItem>
                  <ListItem>
                    <ListItemIcon>
                      <PolicyIcon sx={{ color: 'text.secondary' }} />
                    </ListItemIcon>
                    <ListItemText primary="4. Storage Limitation & Consent-Driven Retention" />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Box>
        </TabPanel>
 
        {/* Tab 2: Choose Models */}
        <TabPanel value={tabValue} index={2}>
          <Box sx={{ width: '100%', height: '100%', maxWidth: 1200 }}>
            <Card
              elevation={0}
              sx={{ border: '1px solid', borderColor: 'divider', bgcolor: '#fff' }}
            >
              <CardHeader
                title="Select Models"
                subheader="Select your models to be used for all chatbots"
                sx={{ pb: 0 }}
              />
              <Divider />
              <CardContent>
                <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                  Choose one to three models.
                </Typography>
 
                <Box
                  sx={{
                    display: 'grid',
                    gap: 2,
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(3, 1fr)',
                      md: 'repeat(4, 1fr)',
                      lg: 'repeat(5, 1fr)',
                    },
                  }}
                >
                  {availableModels.map((m) => (
                    <Box
                      key={m}
                      sx={{
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1,
                        p: 1,
                        minHeight: 56,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        height: '100%',
                      }}
                    >
                      <Typography variant="body1">{m}</Typography>
                      <Checkbox
                        edge="end"
                        checked={selectedModels.includes(m)}
                        onChange={() => toggleModel(m)}
                        inputProps={{ 'aria-label': `select model ${m}` }}
                      />
                    </Box>
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Box>
        </TabPanel>
        {/* Tab 3: Email Automation */}
        <TabPanel value={tabValue} index={3}>
          <DailySummarySettings />
        </TabPanel>
      </Paper>
    </Box>
  );
};
 
export default Settings;