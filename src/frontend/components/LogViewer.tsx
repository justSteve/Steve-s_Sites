import React, { useState, useEffect } from 'react';

interface LogFile {
  path: string;
  name: string;
  size: number;
  modified: string;
}

interface LogContent {
  filename: string;
  lines: string[];
  totalLines: number;
  offset: number;
  hasMore: boolean;
}

const LogViewer: React.FC = () => {
  const [logFiles, setLogFiles] = useState<LogFile[]>([]);
  const [selectedLog, setSelectedLog] = useState<string | null>(null);
  const [logContent, setLogContent] = useState<LogContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [autoScroll, setAutoScroll] = useState(false);

  // Fetch available log files
  useEffect(() => {
    fetch('/api/logs')
      .then(res => res.json())
      .then(data => {
        setLogFiles(data.logs || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // Fetch log content when selected log changes
  useEffect(() => {
    if (!selectedLog) return;

    setLoading(true);
    setError(null);

    fetch(`/api/logs/${selectedLog}?lines=100&offset=${offset}`)
      .then(res => res.json())
      .then(data => {
        setLogContent(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [selectedLog, offset]);

  const handleLogSelect = (filename: string) => {
    setSelectedLog(filename);
    setOffset(0);
  };

  const handleLoadMore = () => {
    if (logContent) {
      setOffset(logContent.offset + 100);
    }
  };

  const handleLoadPrevious = () => {
    if (logContent) {
      setOffset(Math.max(0, logContent.offset - 100));
    }
  };

  const getLogLineClass = (line: string): string => {
    if (line.includes('error') || line.includes('ERROR')) return 'log-line error';
    if (line.includes('warn') || line.includes('WARN')) return 'log-line warn';
    if (line.includes('info') || line.includes('INFO')) return 'log-line info';
    return 'log-line';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading && logFiles.length === 0) {
    return <div className="loading">Loading log files</div>;
  }

  if (error && logFiles.length === 0) {
    return <div className="error">Error loading logs: {error}</div>;
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Log Files</h2>
        </div>

        {logFiles.length === 0 ? (
          <p>No log files found. Log files will appear here after running CLI tools.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {logFiles.map(log => (
              <button
                key={log.name}
                className={`btn ${selectedLog === log.name ? 'active' : ''}`}
                onClick={() => handleLogSelect(log.name)}
                style={{ padding: '0.5rem 1rem' }}
              >
                {log.name}
                <span style={{ marginLeft: '0.5rem', color: '#008800', fontSize: '0.75rem' }}>
                  ({formatFileSize(log.size)})
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedLog && logContent && (
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="card-title">
              {selectedLog} (Lines {logContent.offset + 1}-{logContent.offset + logContent.lines.length} of {logContent.totalLines})
            </h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className="btn"
                onClick={handleLoadPrevious}
                disabled={offset === 0}
                style={{ padding: '0.5rem 1rem' }}
              >
                Previous
              </button>
              <button
                className="btn"
                onClick={handleLoadMore}
                disabled={!logContent.hasMore}
                style={{ padding: '0.5rem 1rem' }}
              >
                Next
              </button>
            </div>
          </div>

          <div className="log-viewer">
            {logContent.lines.map((line, idx) => (
              <div key={idx} className={getLogLineClass(line)}>
                <span style={{ color: '#008800', marginRight: '1rem' }}>
                  {logContent.offset + idx + 1}:
                </span>
                {line}
              </div>
            ))}
            {logContent.lines.length === 0 && (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#008800' }}>
                No lines in this range
              </div>
            )}
          </div>
        </div>
      )}

      {selectedLog && loading && (
        <div className="loading">Loading log content</div>
      )}

      {selectedLog && error && (
        <div className="error">Error loading log content: {error}</div>
      )}
    </div>
  );
};

export default LogViewer;
