import React, { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  FormControlLabel,
  Checkbox,
  Box,
  IconButton,
  Tooltip,
  Alert,
} from '@mui/material';
import { ContentCopy as CopyIcon } from '@mui/icons-material';
import { buildCommand, CommandOptions } from '../../../utils/commandBuilder';

type ToolType = 'cdx-analyzer' | 'crawler' | 'selector' | 'generator';

export const CommandBuilder: React.FC = () => {
  const [tool, setTool] = useState<ToolType>('cdx-analyzer');
  const [options, setOptions] = useState<Record<string, any>>({});
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const command = buildCommand({ tool, ...options });
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const command = buildCommand({ tool, ...options });

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Command Builder
        </Typography>

        <Typography variant="caption" color="text.secondary" paragraph>
          Build CLI commands to run in your terminal
        </Typography>

        <Box display="flex" flexDirection="column" gap={2}>
          {/* Tool Selection */}
          <FormControl fullWidth size="small">
            <InputLabel>Tool</InputLabel>
            <Select
              value={tool}
              label="Tool"
              onChange={(e) => {
                setTool(e.target.value as ToolType);
                setOptions({}); // Reset options when tool changes
              }}
            >
              <MenuItem value="cdx-analyzer">CDX Analyzer</MenuItem>
              <MenuItem value="crawler">Crawler</MenuItem>
              <MenuItem value="selector">Selector</MenuItem>
              <MenuItem value="generator">Generator</MenuItem>
            </Select>
          </FormControl>

          {/* CDX Analyzer Options */}
          {tool === 'cdx-analyzer' && (
            <>
              <TextField
                label="Config File"
                size="small"
                value={options.config || ''}
                onChange={(e) => setOptions({ ...options, config: e.target.value })}
                placeholder="domains.json"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={options.reportOnly || false}
                    onChange={(e) => setOptions({ ...options, reportOnly: e.target.checked })}
                  />
                }
                label="Report Only (skip analysis)"
              />
            </>
          )}

          {/* Crawler Options */}
          {tool === 'crawler' && (
            <>
              <TextField
                label="Snapshots File"
                size="small"
                value={options.snapshots || ''}
                onChange={(e) => setOptions({ ...options, snapshots: e.target.value })}
                placeholder="selected_snapshots.txt"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={options.fetchAssets !== false}
                    onChange={(e) => setOptions({ ...options, fetchAssets: e.target.checked })}
                  />
                }
                label="Fetch Assets (CSS, JS, images)"
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={options.useScheduler !== false}
                    onChange={(e) => setOptions({ ...options, useScheduler: e.target.checked })}
                  />
                }
                label="Use Off-Peak Scheduler"
              />
            </>
          )}

          {/* Selector Options */}
          {tool === 'selector' && (
            <>
              <TextField
                label="Domain"
                size="small"
                required
                value={options.domain || ''}
                onChange={(e) => setOptions({ ...options, domain: e.target.value })}
                placeholder="example.com"
              />
              <FormControl fullWidth size="small">
                <InputLabel>Strategy</InputLabel>
                <Select
                  value={options.strategy || 'all'}
                  label="Strategy"
                  onChange={(e) => setOptions({ ...options, strategy: e.target.value })}
                >
                  <MenuItem value="all">All Unique Snapshots</MenuItem>
                  <MenuItem value="significant">Significant Changes Only</MenuItem>
                  <MenuItem value="yearly">One Per Year</MenuItem>
                  <MenuItem value="top">Top N Snapshots</MenuItem>
                </Select>
              </FormControl>
              <TextField
                label="Export File"
                size="small"
                value={options.export || ''}
                onChange={(e) => setOptions({ ...options, export: e.target.value })}
                placeholder="selected_snapshots.txt"
              />
            </>
          )}

          {/* Generator Options */}
          {tool === 'generator' && (
            <>
              <TextField
                label="Domain (optional - leave blank for all)"
                size="small"
                value={options.domain || ''}
                onChange={(e) => setOptions({ ...options, domain: e.target.value })}
                placeholder="example.com"
              />
              <TextField
                label="Output Directory"
                size="small"
                value={options.output || ''}
                onChange={(e) => setOptions({ ...options, output: e.target.value })}
                placeholder="reports"
              />
            </>
          )}

          {/* Generated Command */}
          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              Generated Command:
            </Typography>
            <Box
              sx={{
                bgcolor: 'background.default',
                p: 1.5,
                borderRadius: 1,
                fontFamily: 'monospace',
                fontSize: '0.85rem',
                position: 'relative',
                border: '1px solid',
                borderColor: 'divider',
                wordBreak: 'break-all',
              }}
            >
              {command}
              <Tooltip title={copied ? 'Copied!' : 'Copy to clipboard'}>
                <IconButton
                  size="small"
                  onClick={handleCopy}
                  sx={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                  }}
                >
                  <CopyIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {copied && (
            <Alert severity="success" sx={{ mt: 1 }}>
              Command copied to clipboard!
            </Alert>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};
