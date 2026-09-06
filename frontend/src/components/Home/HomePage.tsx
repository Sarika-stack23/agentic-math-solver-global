import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Send, Camera, FileText, BookOpen, Clock, BarChart3, Sparkles } from 'lucide-react';
import { t, tArray } from '../../i18n';

export const HomePage: React.FC = () => {
  const [input, setInput] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    navigate('/solve', { state: { initialQuery: input } });
  };

  const handleSuggestion = (q: string) => {
    navigate('/solve', { state: { initialQuery: q } });
  };

  const suggestions = tArray('home.suggestions');

  return (
    <div className="home-container" style={{ paddingBottom: '4rem' }}>
      {/* Clean background — no messy floating symbols */}

      <div style={{ marginBottom: '1.5rem', marginTop: '2rem' }}>
        <div style={{ width: 48, height: 48, background: 'var(--accent)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-md)' }}>
          <Sparkles size={24} color="white" />
        </div>
      </div>

      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '3rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '1rem', letterSpacing: '-0.02em' }}>
        AI-Powered Mathematics Workspace
      </h1>
      <p style={{ fontFamily: 'var(--font-sans)', fontSize: '1.1rem', color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 3rem', lineHeight: '1.6' }}>
        A professional environment for exploring, verifying, and understanding mathematics symbolically.
      </p>

      {/* Main input */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', maxWidth: '700px', width: '100%', marginBottom: '3rem', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '4px', paddingLeft: '16px', boxShadow: 'var(--shadow-sm)' }}>
        <input
          type="text"
          style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '1.1rem', outline: 'none' }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('home.typeProblem')}
          aria-label={t('home.typeProblem')}
          autoFocus
        />
        <button type="submit" className="btn btn-primary" style={{ padding: '12px 24px', borderRadius: 'var(--radius-lg)' }} disabled={!input.trim()} aria-label={t('solve.send')}>
          <Send size={20} />
        </button>
      </form>

      {/* Visual Action Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem', maxWidth: '800px', width: '100%' }}>
        
        <div className="card action-card" onClick={() => { if (input.trim()) handleSuggestion(`Check my work for: ${input}`); }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ padding: '8px', background: 'var(--accent-subtle)', borderRadius: '8px', color: 'var(--accent)' }}>
              <BookOpen size={20} />
            </div>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Check My Work</span>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
            Verify your own steps and get symbolic confirmation.
          </p>
        </div>

        <div className="card action-card" onClick={() => navigate('/solve', { state: { openCamera: true } })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ padding: '8px', background: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--text-primary)' }}>
              <Camera size={20} />
            </div>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('home.takePhoto')}</span>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
            Scan handwritten equations directly from your camera.
          </p>
        </div>

        <div className="card action-card" onClick={() => navigate('/solve', { state: { openPdf: true } })}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
            <div style={{ padding: '8px', background: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--text-primary)' }}>
              <FileText size={20} />
            </div>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{t('home.uploadPdf')}</span>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0 }}>
            Extract and solve math from textbooks and worksheets.
          </p>
        </div>

      </div>

      {/* Suggestion chips */}
      <div className="home-suggestions" style={{ marginTop: '2.5rem', maxWidth: '700px' }}>
        {suggestions.map((q) => (
          <button key={q} className="action-chip" style={{ padding: '8px 16px', background: 'var(--bg-glass)' }} onClick={() => handleSuggestion(q)}>
            {q}
          </button>
        ))}
      </div>

      {/* Secondary navigation */}
      <div style={{ display: 'flex', gap: '1.5rem', marginTop: '3.5rem', borderTop: '1px solid var(--border)', paddingTop: '2rem', width: '100%', maxWidth: '700px', justifyContent: 'center' }}>
        <button className="btn btn-ghost" onClick={() => navigate('/practice')} style={{ fontSize: '1rem', gap: '8px' }}>
          <BookOpen size={18} /> {t('home.quickActions.practice')}
        </button>
        <button className="btn btn-ghost" onClick={() => navigate('/history')} style={{ fontSize: '1rem', gap: '8px' }}>
          <Clock size={18} /> {t('home.quickActions.history')}
        </button>
        <button className="btn btn-ghost" onClick={() => navigate('/progress')} style={{ fontSize: '1rem', gap: '8px' }}>
          <BarChart3 size={18} /> {t('home.quickActions.progress')}
        </button>
      </div>
    </div>
  );
};
