import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  CircularProgress,
  Box,
  Alert,
  Chip,
} from '@mui/material';
import { Language as LanguageIcon } from '@mui/icons-material';

interface DomainListPanelProps {
  onDomainSelect: (domain: string) => void;
}

export const DomainListPanel: React.FC<DomainListPanelProps> = ({ onDomainSelect }) => {
  const [domains, setDomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDomains = async () => {
      try {
        const res = await fetch('/api/domains');
        const data = await res.json();
        setDomains(data.domains || []);
        setError(null);
      } catch (err) {
        setError('Failed to load domains');
      } finally {
        setLoading(false);
      }
    };

    fetchDomains();
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

  if (error) {
    return (
      <Card>
        <CardContent>
          <Alert severity="error">{error}</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            Domains
          </Typography>
          <Chip
            label={`${domains.length} total`}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Box>

        {domains.length === 0 ? (
          <Alert severity="info">
            No domains found. Run CDX Analyzer to populate the database.
          </Alert>
        ) : (
          <List dense sx={{ maxHeight: 400, overflow: 'auto' }}>
            {domains.map((domain) => (
              <ListItem key={domain} disablePadding>
                <ListItemButton onClick={() => onDomainSelect(domain)}>
                  <LanguageIcon fontSize="small" sx={{ mr: 1.5, color: 'primary.main' }} />
                  <ListItemText
                    primary={domain}
                    primaryTypographyProps={{ variant: 'body2' }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </CardContent>
    </Card>
  );
};
