import React, { useState } from 'react';
import { Clock, ArrowRight, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { t } from '../../i18n';

interface HistoryItem {
  id: string;
  problem: string;
  topic: string;
  date: string;
  result: string;
}

export const HistoryPanel: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('math_tutor_history');
      if (stored) {
        setHistoryItems(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load history', e);
    }
  }, []);

  const filteredItems = historyItems.filter(
    (item) =>
      item.problem.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.topic.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="page-container" style={{ overflowY: 'auto', flex: 1 }}>
      <div className="page-header">
        <h2>{t('history.title')}</h2>
        <p>{t('history.subtitle')}</p>
      </div>

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input
          type="text"
          className="input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('history.search')}
          style={{ paddingLeft: '36px' }}
          aria-label={t('history.search')}
        />
      </div>

      {filteredItems.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Clock size={48} /></div>
          <p>{t('history.noHistory')}</p>
          <button className="btn btn-primary" onClick={() => navigate('/solve')} style={{ marginTop: '1rem' }}>
            {t('nav.solve')}
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filteredItems.map((item) => (
            <div key={item.id} className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
              onClick={() => navigate('/solve', { state: { initialQuery: item.problem } })}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 500, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.problem}
                </div>
                <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span>{item.topic}</span>
                  <span>{item.date}</span>
                </div>
              </div>
              <button className="btn btn-ghost" aria-label={t('history.reopen')}>
                <ArrowRight size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
