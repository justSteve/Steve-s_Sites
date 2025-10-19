import React, { useState, useEffect } from 'react';

interface SnapshotViewerProps {
  domain: string;
  timestamp: string;
  snapshotUrl: string;
  onClose: () => void;
}

interface Manifest {
  domain: string;
  timestamp: string;
  crawledAt: string;
  pages: string[];
  assets: {
    total: number;
    byType: Record<string, number>;
    totalSizeMB: number;
    externalDomains: string[];
  };
  skippedCount: number;
}

export const SnapshotViewer: React.FC<SnapshotViewerProps> = ({
  domain,
  timestamp,
  snapshotUrl,
  onClose,
}) => {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const archiveUrl = `/archive/${domain}/${timestamp}/index.html`;

  useEffect(() => {
    // Fetch manifest
    fetch(`/archive/${domain}/${timestamp}/manifest.json`)
      .then(res => res.json())
      .then(data => {
        setManifest(data);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load manifest');
        setLoading(false);
      });
  }, [domain, timestamp]);

  const formatDate = (timestamp: string) => {
    const year = timestamp.substring(0, 4);
    const month = timestamp.substring(4, 6);
    const day = timestamp.substring(6, 8);
    const hour = timestamp.substring(8, 10);
    const minute = timestamp.substring(10, 12);
    return `${year}-${month}-${day} ${hour}:${minute}`;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.8)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'row',
    }}>
      {/* Metadata Panel */}
      <div style={{
        width: '300px',
        backgroundColor: '#1e1e1e',
        color: '#fff',
        padding: '20px',
        overflowY: 'auto',
      }}>
        <div style={{ marginBottom: '20px' }}>
          <button onClick={onClose} style={{
            backgroundColor: '#444',
            color: '#fff',
            border: 'none',
            padding: '10px 20px',
            cursor: 'pointer',
            borderRadius: '4px',
          }}>
            Close
          </button>
        </div>

        <h2 style={{ fontSize: '18px', marginBottom: '10px' }}>Snapshot Info</h2>
        <p><strong>Domain:</strong> {domain}</p>
        <p><strong>Timestamp:</strong> {formatDate(timestamp)}</p>
        <p><strong>URL:</strong> <a href={snapshotUrl} target="_blank" rel="noopener" style={{ color: '#4a9eff' }}>{snapshotUrl}</a></p>

        {loading && <p>Loading manifest...</p>}
        {error && <p style={{ color: '#ff6b6b' }}>{error}</p>}

        {manifest && (
          <>
            <h3 style={{ fontSize: '16px', marginTop: '20px' }}>Assets</h3>
            <p><strong>Total:</strong> {manifest.assets.total}</p>
            <p><strong>Total Size:</strong> {manifest.assets.totalSizeMB.toFixed(2)} MB</p>
            <p><strong>Skipped:</strong> {manifest.skippedCount}</p>

            <h4 style={{ fontSize: '14px', marginTop: '10px' }}>By Type:</h4>
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {Object.entries(manifest.assets.byType).map(([type, count]) => (
                <li key={type}>
                  {type}: {count}
                </li>
              ))}
            </ul>

            {manifest.assets.externalDomains.length > 0 && (
              <>
                <h4 style={{ fontSize: '14px', marginTop: '10px' }}>External Domains:</h4>
                <ul style={{ listStyle: 'none', padding: 0, fontSize: '12px' }}>
                  {manifest.assets.externalDomains.map(d => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              </>
            )}
          </>
        )}

        <div style={{ marginTop: '20px' }}>
          <a
            href={archiveUrl}
            target="_blank"
            rel="noopener"
            style={{
              display: 'inline-block',
              backgroundColor: '#4a9eff',
              color: '#fff',
              padding: '10px 20px',
              textDecoration: 'none',
              borderRadius: '4px',
            }}
          >
            Open in New Tab
          </a>
        </div>
      </div>

      {/* Iframe Viewer */}
      <div style={{ flex: 1, backgroundColor: '#fff' }}>
        <iframe
          src={archiveUrl}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
          }}
          title={`Snapshot ${timestamp}`}
        />
      </div>
    </div>
  );
};
