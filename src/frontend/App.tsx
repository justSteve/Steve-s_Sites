import React, { useState } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Grid,
  Button,
  Box,
  Chip,
} from '@mui/material';
import { SystemStatus, CommandBuilder, DomainListPanel } from './components/Dashboard';
import DomainPage from './components/DomainPage';
import LogViewer from './components/LogViewer';

/**
 * Wayback Archive Toolkit - Main Application
 *
 * Note: @myorg/dashboard-ui provides DashboardLayout and generic components
 * for new projects. WBM uses a custom layout for its specific navigation needs.
 */

type View = 'dashboard' | 'domain' | 'logs';

const App: React.FC = () => {
  const [view, setView] = useState<View>('dashboard');
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  const handleDomainSelect = (domain: string) => {
    setSelectedDomain(domain);
    setView('domain');
  };

  const handleNavigation = (newView: View) => {
    setView(newView);
    if (newView === 'dashboard') {
      setSelectedDomain(null);
    }
  };

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="static" elevation={0}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Wayback Archive Toolkit
          </Typography>
          <Chip
            label="Dashboard"
            color="primary"
            size="small"
            variant="outlined"
          />
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 3, mb: 3 }}>
        {/* Navigation */}
        <Box sx={{ mb: 3, display: 'flex', gap: 1 }}>
          <Button
            variant={view === 'dashboard' ? 'contained' : 'outlined'}
            onClick={() => handleNavigation('dashboard')}
          >
            Dashboard
          </Button>
          <Button
            variant={view === 'logs' ? 'contained' : 'outlined'}
            onClick={() => handleNavigation('logs')}
          >
            Logs
          </Button>
          {selectedDomain && (
            <Chip
              label={selectedDomain}
              color="primary"
              onDelete={() => handleNavigation('dashboard')}
            />
          )}
        </Box>

        {/* Main Content */}
        {/* Using Grid v1 (@mui/material/Grid) instead of Grid2 for better compatibility
            with the current Material-UI setup and to avoid potential breaking changes.
            Grid v1 is stable and well-supported for this use case. */}
        {view === 'dashboard' && (
          <Grid container spacing={3}>
            {/* System Status - Left Column */}
            <Grid item xs={12} md={4}>
              <SystemStatus />
            </Grid>

            {/* Domain List - Center Column */}
            <Grid item xs={12} md={4}>
              <DomainListPanel onDomainSelect={handleDomainSelect} />
            </Grid>

            {/* Command Builder - Right Column */}
            <Grid item xs={12} md={4}>
              <CommandBuilder />
            </Grid>
          </Grid>
        )}

        {view === 'domain' && selectedDomain && (
          <DomainPage domain={selectedDomain} />
        )}

        {view === 'logs' && <LogViewer />}
      </Container>
    </Box>
  );
};

export default App;
