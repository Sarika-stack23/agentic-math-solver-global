import React, { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, GraduationCap, Globe, Palette } from 'lucide-react';
import { t } from '../../i18n';

type Theme = 'dark' | 'light' | 'auto';

export const SettingsPanel: React.FC = () => {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme) || 'dark';
  });
  const [educationLevel, setEducationLevel] = useState(() => {
    return localStorage.getItem('education_level') || 'high_school';
  });

  useEffect(() => {
    if (theme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      document.documentElement.setAttribute('data-theme', theme);
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('education_level', educationLevel);
  }, [educationLevel]);



  return (
    <div className="page-container" style={{ overflowY: 'auto', flex: 1 }}>
      <div className="page-header">
        <h2>{t('settings.title')}</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px' }}>
        {/* Education Level */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <GraduationCap size={20} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: '1rem', margin: 0 }}>{t('settings.educationLevel.title')}</h3>
          </div>
          <select
            className="input"
            value={educationLevel}
            onChange={(e) => setEducationLevel(e.target.value)}
            aria-label={t('settings.educationLevel.title')}
          >
            <option value="middle_school">{t('settings.educationLevel.middleSchool')}</option>
            <option value="high_school">{t('settings.educationLevel.highSchool')}</option>
            <option value="college">{t('settings.educationLevel.college')}</option>
            <option value="university">{t('settings.educationLevel.university')}</option>
            <option value="other">{t('settings.educationLevel.other')}</option>
          </select>
        </div>

        {/* Language */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Globe size={20} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: '1rem', margin: 0 }}>{t('settings.language.title')}</h3>
          </div>
          <select className="input" defaultValue="en" aria-label={t('settings.language.title')}>
            <option value="en">{t('settings.language.en')}</option>
          </select>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            More languages coming soon.
          </p>
        </div>

        {/* Theme */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <Palette size={20} style={{ color: 'var(--accent)' }} />
            <h3 style={{ fontSize: '1rem', margin: 0 }}>{t('settings.theme.title')}</h3>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTheme('dark')}
              aria-pressed={theme === 'dark'}
            >
              <Moon size={16} /> {t('settings.theme.dark')}
            </button>
            <button
              className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTheme('light')}
              aria-pressed={theme === 'light'}
            >
              <Sun size={16} /> {t('settings.theme.light')}
            </button>
            <button
              className={`btn ${theme === 'auto' ? 'btn-primary' : 'btn-outline'}`}
              onClick={() => setTheme('auto')}
              aria-pressed={theme === 'auto'}
            >
              <Monitor size={16} /> {t('settings.theme.auto')}
            </button>
          </div>
        </div>


      </div>
    </div>
  );
};
