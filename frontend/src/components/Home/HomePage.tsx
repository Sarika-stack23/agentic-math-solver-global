import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Image as ImageIcon, Camera, FileText, BookOpen, Clock, BarChart3 } from 'lucide-react';
import { t, tArray } from '../../i18n';

export const HomePage: React.FC = () => {
  const [input, setInput] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    // Navigate to solve page with the query
    navigate('/solve', { state: { initialQuery: input } });
  };

  const handleSuggestion = (q: string) => {
    navigate('/solve', { state: { initialQuery: q } });
  };

  const suggestions = tArray('home.suggestions');

  return (
    <div className="home-container">
      <h1 className="home-headline">
        <span className="text-gradient">{t('home.headline')}</span>
      </h1>
      <p className="home-subheadline">
        {t('home.subheadline')}
      </p>

      {/* Main input */}
      <form onSubmit={handleSubmit} className="home-input-group">
        <input
          type="text"
          className="input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('home.typeProblem')}
          aria-label={t('home.typeProblem')}
          autoFocus
        />
        <button type="submit" className="btn btn-primary" disabled={!input.trim()} aria-label={t('solve.send')}>
          <Send size={20} />
        </button>
      </form>

      {/* Quick action buttons */}
      <div className="home-actions">
        <button className="btn btn-secondary" onClick={() => navigate('/solve', { state: { openCamera: true } })}>
          <Camera size={18} /> {t('home.takePhoto')}
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/solve', { state: { openImage: true } })}>
          <ImageIcon size={18} /> {t('home.uploadImage')}
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/solve', { state: { openPdf: true } })}>
          <FileText size={18} /> {t('home.uploadPdf')}
        </button>
      </div>

      {/* Suggestion chips */}
      <div className="home-suggestions">
        {suggestions.map((q) => (
          <button key={q} className="action-chip" onClick={() => handleSuggestion(q)}>
            {q}
          </button>
        ))}
      </div>

      {/* Secondary navigation */}
      <div style={{ display: 'flex', gap: '2rem', marginTop: '3rem', color: 'hsl(var(--text-muted))', fontSize: '0.9rem' }}>
        <button className="btn btn-ghost" onClick={() => navigate('/practice')} style={{ fontSize: '0.9rem' }}>
          <BookOpen size={16} /> {t('home.quickActions.practice')}
        </button>
        <button className="btn btn-ghost" onClick={() => navigate('/history')} style={{ fontSize: '0.9rem' }}>
          <Clock size={16} /> {t('home.quickActions.history')}
        </button>
        <button className="btn btn-ghost" onClick={() => navigate('/progress')} style={{ fontSize: '0.9rem' }}>
          <BarChart3 size={16} /> {t('home.quickActions.progress')}
        </button>
      </div>
    </div>
  );
};
