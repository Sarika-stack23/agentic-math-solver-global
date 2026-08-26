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

      {/* Logo icon */}
      <div style={{ marginBottom: '1.5rem', marginTop: '2rem' }} className="animate-float">
        <div className="icon-badge" style={{ width: 72, height: 72, borderRadius: 20, fontSize: '2rem' }}>
          <Sparkles size={36} color="white" />
        </div>
      </div>

      <h1 className="home-headline" style={{ marginBottom: '0.5rem', fontSize: '3rem' }}>
        <span className="text-gradient">AI-Powered Mathematics</span>
      </h1>
      <p className="home-subheadline" style={{ maxWidth: '600px', margin: '0 auto 2.5rem', fontSize: '1.1rem' }}>
        Understand math. Don't just get the answer. Symbolically verified where supported.
      </p>

      {/* Main input */}
      <form onSubmit={handleSubmit} className="home-input-group" style={{ maxWidth: '700px', width: '100%' }}>
        <input
          type="text"
          className="input"
          style={{ padding: '16px 24px', fontSize: '1.1rem', borderRadius: '16px' }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('home.typeProblem')}
          aria-label={t('home.typeProblem')}
          autoFocus
        />
        <button type="submit" className="btn btn-primary" style={{ padding: '0 24px', borderRadius: '14px' }} disabled={!input.trim()} aria-label={t('solve.send')}>
          <Send size={24} />
        </button>
      </form>

      {/* Visual Action Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        maxWidth: '700px',
        width: '100%',
        marginTop: '1.5rem'
      }}>
        <div
          className="card glass"
          style={{ padding: '1.5rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', border: '1px solid var(--accent)' }}
          onClick={() => {
            if (!input.trim()) return;
            handleSuggestion(`Check my work for: ${input}`);
          }}
        >
          <div style={{ background: 'var(--accent-glow)', padding: '12px', borderRadius: '50%' }}>
            <Sparkles size={24} color="var(--accent)" />
          </div>
          <span style={{ fontWeight: 600 }}>Check My Work</span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Already solved it? Verify your steps.</span>
        </div>

        <div
          className="card glass"
          style={{ padding: '1.5rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
          onClick={() => navigate('/solve', { state: { openCamera: true } })}
        >
          <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: '50%', border: '1px solid var(--border)' }}>
            <Camera size={24} color="var(--text-secondary)" />
          </div>
          <span style={{ fontWeight: 600 }}>{t('home.takePhoto')}</span>
        </div>

        <div
          className="card glass"
          style={{ padding: '1.5rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
          onClick={() => navigate('/solve', { state: { openPdf: true } })}
        >
          <div style={{ background: 'var(--bg-elevated)', padding: '12px', borderRadius: '50%', border: '1px solid var(--border)' }}>
            <FileText size={24} color="var(--text-secondary)" />
          </div>
          <span style={{ fontWeight: 600 }}>{t('home.uploadPdf')}</span>
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
