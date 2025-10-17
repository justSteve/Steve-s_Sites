import React, { useState, useEffect } from 'react';

interface DomainListProps {
  onDomainSelect: (domain: string) => void;
}

const DomainList: React.FC<DomainListProps> = ({ onDomainSelect }) => {
  const [domains, setDomains] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/domains')
      .then(res => res.json())
      .then(data => {
        setDomains(data.domains || []);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div className="loading">Loading domains</div>;
  }

  if (error) {
    return <div className="error">Error loading domains: {error}</div>;
  }

  if (domains.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">No Domains Found</h2>
        </div>
        <p>No domain data available. Run the CDX analyzer to collect data:</p>
        <pre style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#1a1a1a' }}>
          npm run cdx-analyzer -- --config config.json
        </pre>
      </div>
    );
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Available Domains ({domains.length})</h2>
        </div>
        <p>Select a domain to view its archive timeline and snapshots.</p>
      </div>

      <div className="domain-list">
        {domains.map(domain => (
          <div
            key={domain}
            className="domain-card"
            onClick={() => onDomainSelect(domain)}
          >
            <div className="domain-name">{domain}</div>
            <div className="domain-stats">Click to view details</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DomainList;
