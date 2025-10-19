import React, { useState, useEffect } from 'react';
import { SnapshotViewer } from './SnapshotViewer';

interface DomainPageProps {
  domain: string;
}

interface DomainStats {
  total_snapshots: number;
  first_snapshot: string;
  last_snapshot: string;
  years_covered: number;
}

interface StatusCode {
  statuscode: string;
  count: number;
}

interface Snapshot {
  timestamp: string;
  url: string;
  statuscode: string;
  mimetype: string;
  change_score?: number;
}

interface DomainData {
  domain: string;
  stats: DomainStats;
  statusCodes: StatusCode[];
  recentSnapshots: Snapshot[];
}

interface TimelineData {
  [year: string]: Snapshot[];
}

const formatTimestamp = (ts: string): string => {
  if (!ts || ts.length < 14) return ts;
  const year = ts.substring(0, 4);
  const month = ts.substring(4, 6);
  const day = ts.substring(6, 8);
  const hour = ts.substring(8, 10);
  const min = ts.substring(10, 12);
  const sec = ts.substring(12, 14);
  return `${year}-${month}-${day} ${hour}:${min}:${sec}`;
};

const getStatusClass = (code: string): string => {
  if (code === '200') return 'status-200';
  if (code === '302') return 'status-302';
  if (['403', '404', '500'].includes(code)) return `status-${code}`;
  return '';
};

const DomainPage: React.FC<DomainPageProps> = ({ domain }) => {
  const [data, setData] = useState<DomainData | null>(null);
  const [timeline, setTimeline] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'stats' | 'timeline'>('stats');
  const [selectedSnapshot, setSelectedSnapshot] = useState<{
    domain: string;
    timestamp: string;
    url: string;
  } | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Fetch domain summary
    fetch(`/api/domains/${domain}`)
      .then(res => res.json())
      .then(domainData => {
        setData(domainData);

        // Fetch timeline data
        return fetch(`/api/domains/${domain}/timeline`);
      })
      .then(res => res.json())
      .then(timelineData => {
        setTimeline(timelineData.timeline);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [domain]);

  if (loading) {
    return <div className="loading">Loading domain data</div>;
  }

  if (error) {
    return <div className="error">Error loading domain: {error}</div>;
  }

  if (!data) {
    return <div className="error">No data available for {domain}</div>;
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{domain}</h2>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{data.stats.total_snapshots}</div>
            <div className="stat-label">Total Snapshots</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{data.stats.years_covered}</div>
            <div className="stat-label">Years Covered</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatTimestamp(data.stats.first_snapshot).substring(0, 10)}</div>
            <div className="stat-label">First Snapshot</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{formatTimestamp(data.stats.last_snapshot).substring(0, 10)}</div>
            <div className="stat-label">Last Snapshot</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Status Code Distribution</h3>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          {data.statusCodes.map(sc => (
            <div key={sc.statuscode} style={{ flex: '1 1 150px' }}>
              <span className={getStatusClass(sc.statuscode)} style={{ fontWeight: 'bold' }}>
                {sc.statuscode}
              </span>
              : {sc.count}
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 className="card-title">
            {viewMode === 'stats' ? 'Recent Snapshots' : 'Timeline'}
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className={`btn ${viewMode === 'stats' ? 'active' : ''}`}
              onClick={() => setViewMode('stats')}
              style={{ padding: '0.5rem 1rem' }}
            >
              Recent
            </button>
            <button
              className={`btn ${viewMode === 'timeline' ? 'active' : ''}`}
              onClick={() => setViewMode('timeline')}
              style={{ padding: '0.5rem 1rem' }}
            >
              Timeline
            </button>
          </div>
        </div>

        {viewMode === 'stats' && (
          <div className="snapshot-list">
            {data.recentSnapshots.map((snap, idx) => (
              <div
                key={idx}
                className="snapshot-item"
                onClick={() => setSelectedSnapshot({
                  domain,
                  timestamp: snap.timestamp,
                  url: snap.url,
                })}
                style={{ cursor: 'pointer' }}
              >
                <span className="snapshot-timestamp">{formatTimestamp(snap.timestamp)}</span>
                <span className="snapshot-url">{snap.url}</span>
                <span className={`snapshot-status ${getStatusClass(snap.statuscode)}`}>
                  {snap.statuscode}
                </span>
              </div>
            ))}
          </div>
        )}

        {viewMode === 'timeline' && timeline && (
          <div className="timeline">
            {Object.keys(timeline).sort().reverse().map(year => (
              <div key={year} className="timeline-year">
                <div className="timeline-year-header">
                  {year} ({timeline[year].length} snapshots)
                </div>
                <div className="snapshot-list">
                  {timeline[year].slice(0, 20).map((snap, idx) => (
                    <div
                      key={idx}
                      className="snapshot-item"
                      onClick={() => setSelectedSnapshot({
                        domain,
                        timestamp: snap.timestamp,
                        url: snap.url,
                      })}
                      style={{ cursor: 'pointer' }}
                    >
                      <span className="snapshot-timestamp">{formatTimestamp(snap.timestamp)}</span>
                      <span className="snapshot-url">{snap.url}</span>
                      <span className={`snapshot-status ${getStatusClass(snap.statuscode)}`}>
                        {snap.statuscode}
                      </span>
                      {snap.change_score && (
                        <span style={{ color: '#00ccff', minWidth: '50px' }}>
                          Δ{snap.change_score}
                        </span>
                      )}
                    </div>
                  ))}
                  {timeline[year].length > 20 && (
                    <div style={{ padding: '0.5rem', color: '#008800' }}>
                      ...and {timeline[year].length - 20} more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedSnapshot && (
        <SnapshotViewer
          domain={selectedSnapshot.domain}
          timestamp={selectedSnapshot.timestamp}
          snapshotUrl={selectedSnapshot.url}
          onClose={() => setSelectedSnapshot(null)}
        />
      )}
    </div>
  );
};

export default DomainPage;
