import React, { useState, useEffect } from 'react';
import DomainList from './components/DomainList';
import DomainPage from './components/DomainPage';
import LogViewer from './components/LogViewer';

type View = 'home' | 'domain' | 'logs';

const App: React.FC = () => {
  const [view, setView] = useState<View>('home');
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const [apiStatus, setApiStatus] = useState<boolean>(false);

  useEffect(() => {
    // Check API health
    fetch('/api/health')
      .then(res => res.json())
      .then(data => setApiStatus(data.status === 'ok'))
      .catch(() => setApiStatus(false));
  }, []);

  const handleDomainSelect = (domain: string) => {
    setSelectedDomain(domain);
    setView('domain');
  };

  const handleNavigation = (newView: View) => {
    setView(newView);
    if (newView === 'home') {
      setSelectedDomain(null);
    }
  };

  return (
    <div className="container">
      <header className="header">
        <h1>Wayback Archive - Domain Dashboard</h1>
        <div className="header-subtitle">
          Multi-domain Internet Archive toolkit
          {apiStatus && <span style={{ marginLeft: '1rem' }}>[API: ONLINE]</span>}
          {!apiStatus && <span style={{ marginLeft: '1rem', color: '#ff0000' }}>[API: OFFLINE]</span>}
        </div>
      </header>

      <nav className="nav">
        <button
          className={`nav-link ${view === 'home' ? 'active' : ''}`}
          onClick={() => handleNavigation('home')}
        >
          Domains
        </button>
        <button
          className={`nav-link ${view === 'logs' ? 'active' : ''}`}
          onClick={() => handleNavigation('logs')}
        >
          Logs
        </button>
        {selectedDomain && (
          <span className="nav-link active">
            {selectedDomain}
          </span>
        )}
      </nav>

      <main>
        {!apiStatus && (
          <div className="error">
            API server is offline. Please start the API server at port 3001.
            <br />
            <code>node dist/server/api.js</code>
          </div>
        )}

        {view === 'home' && <DomainList onDomainSelect={handleDomainSelect} />}
        {view === 'domain' && selectedDomain && <DomainPage domain={selectedDomain} />}
        {view === 'logs' && <LogViewer />}
      </main>
    </div>
  );
};

export default App;
