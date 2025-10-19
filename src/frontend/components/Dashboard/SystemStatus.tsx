import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Storage as StorageIcon,
  Language as LanguageIcon,
} from '@mui/icons-material';

interface SystemStats {
  apiStatus: boolean;
  databaseExists: boolean;
  domainCount: number;
  domains: string[];
}

export const SystemStatus: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Check API health
        const healthRes = await fetch('/api/health');
        const healthData = await healthRes.json();

        // Get domains
        const domainsRes = await fetch('/api/domains');
        const domainsData = await domainsRes.json();

        setStats({
          apiStatus: healthData.status === 'ok',
          databaseExists: healthData.database,
          domainCount: domainsData.count || 0,
          domains: domainsData.domains || [],
        });
      } catch (error) {
        setStats({
          apiStatus: false,
          databaseExists: false,
          domainCount: 0,
          domains: [],
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <Card>
        <CardContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          System Status
        </Typography>

        <List dense>
          <ListItem>
            <ListItemText
              primary={
                <Box display="flex" alignItems="center" gap={1}>
                  {stats?.apiStatus ? (
                    <CheckCircleIcon color="success" fontSize="small" />
                  ) : (
                    <ErrorIcon color="error" fontSize="small" />
                  )}
                  <Typography variant="body2">
                    API Server
                  </Typography>
                </Box>
              }
              secondary={
                <Chip
                  label={stats?.apiStatus ? 'Online' : 'Offline'}
                  color={stats?.apiStatus ? 'success' : 'error'}
                  size="small"
                  sx={{ mt: 0.5 }}
                />
              }
            />
          </ListItem>

          <ListItem>
            <ListItemText
              primary={
                <Box display="flex" alignItems="center" gap={1}>
                  <StorageIcon fontSize="small" color={stats?.databaseExists ? 'primary' : 'disabled'} />
                  <Typography variant="body2">
                    Database
                  </Typography>
                </Box>
              }
              secondary={
                <Chip
                  label={stats?.databaseExists ? 'Connected' : 'Not Found'}
                  color={stats?.databaseExists ? 'success' : 'warning'}
                  size="small"
                  sx={{ mt: 0.5 }}
                />
              }
            />
          </ListItem>

          <ListItem>
            <ListItemText
              primary={
                <Box display="flex" alignItems="center" gap={1}>
                  <LanguageIcon fontSize="small" color="primary" />
                  <Typography variant="body2">
                    Domains
                  </Typography>
                </Box>
              }
              secondary={
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  {stats?.domainCount} domains tracked
                </Typography>
              }
            />
          </ListItem>
        </List>

        {stats?.domains && stats.domains.length > 0 && (
          <Box mt={2}>
            <Typography variant="caption" color="text.secondary">
              Recent domains:
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={0.5} mt={1}>
              {stats.domains.slice(0, 5).map((domain) => (
                <Chip
                  key={domain}
                  label={domain}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );
};
