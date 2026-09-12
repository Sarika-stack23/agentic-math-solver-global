import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Flame, Trophy, CheckCircle, BookOpen, Star, TrendingUp } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { t } from '../../i18n';

interface UserStats {
  streak: number;
  total_solved: number;
  accuracy: number;
  weak_topics: string[];
  activity_map: Record<string, number>;
}

export const ProgressDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [errorState, setErrorState] = useState<string | null>(null);
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8080';

  useEffect(() => {
    const fetchProgress = async () => {
      if (!user) {
        setStats({ streak: 0, total_solved: 0, accuracy: 0, weak_topics: [], activity_map: {} });
        return;
      }
      try {
        const token = await user.getIdToken();
        const response = await fetch(`${apiUrl}/api/v1/progress`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setStats({
            streak: data.streak || 0,
            total_solved: data.total_solved || 0,
            accuracy: data.accuracy ?? 100,
            weak_topics: data.weak_topics || [],
            activity_map: data.activity_map || {}
          });
          setErrorState(null);
        } else {
          let errorDetail = "Progress persistence is temporarily unavailable.";
          try {
            const errorData = await response.json();
            if (errorData.detail) errorDetail = errorData.detail;
          } catch (e) {
            // Ignore JSON parse errors on failure
          }
          setErrorState(errorDetail);
        }
      } catch (err) {
        console.error("Failed to fetch progress", err);
        setErrorState("Progress persistence is temporarily unavailable. Network error.");
      }
    };
    fetchProgress();
  }, [user, apiUrl]);

  if (errorState) {
    return (
      <div className="page-container content-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ padding: '2rem', textAlign: 'center', backgroundColor: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', maxWidth: '600px' }}>
          <h2 style={{ marginBottom: '0.5rem', color: 'var(--text-primary)' }}>Progress Unavailable</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
            We're currently unable to load your progress data. Please check your connection and try again.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <div className="loading-indicator">
          <div className="loading-spinner" />
          <span>{t('common.loading')}</span>
        </div>
      </div>
    );
  }

  if (stats.total_solved === 0) {
    return (
      <div className="page-container content-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ padding: '3rem 2rem', textAlign: 'center', backgroundColor: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', maxWidth: '600px', width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
            <TrendingUp size={64} strokeWidth={1} />
          </div>
          <h2 style={{ marginBottom: '0.75rem', color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 600 }}>Your progress will appear here</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
            Start solving math problems or practicing concepts to build your streak and track your accuracy over time.
          </p>
          <button className="btn btn-primary" onClick={() => window.location.href = '/solve'}>
            Start Solving
          </button>
        </div>
      </div>
    );
  }

  const chartData = Array.from({ length: 14 }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const dateStr = d.toISOString().split('T')[0];
    const shortDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return { date: shortDate, solved: stats.activity_map[dateStr] || 0 };
  });

  return (
    <div className="page-container" style={{ overflowY: 'auto', flex: 1 }}>
      <div className="page-header">
        <h2>{t('progress.title')}</h2>
      </div>

      {stats.total_solved === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', backgroundColor: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border)', marginTop: '2rem' }}>
          <Trophy size={48} style={{ color: 'var(--accent)', margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3 style={{ marginBottom: '0.5rem' }}>No Problems Solved Yet</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Start solving problems to see your progress here.</p>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="stats-grid" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)' }}>
            <Flame size={28} />
          </div>
          <div>
            <div className="stat-label">{t('progress.streak')}</div>
            <div className="stat-value">{stats.streak} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>{t('progress.days')}</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(99, 102, 241, 0.12)', color: 'var(--accent)' }}>
            <Trophy size={28} />
          </div>
          <div>
            <div className="stat-label">{t('progress.totalSolved')}</div>
            <div className="stat-value">{stats.total_solved}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)', color: 'var(--success)' }}>
            <CheckCircle size={28} />
          </div>
          <div>
            <div className="stat-label">{t('progress.accuracy')}</div>
            <div className="stat-value">{stats.accuracy}%</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'rgba(168, 85, 247, 0.12)', color: 'var(--accent-secondary)' }}>
            <Star size={28} />
          </div>
          <div>
            <div className="stat-label">{t('progress.score')}</div>
            <div className="stat-value">{(stats.total_solved * 100) + (stats.streak * 50)}</div>
          </div>
        </div>
      </div>

      {/* Two-column layout: Heatmap + Weak Topics */}
      <div className="two-col-grid" style={{ marginBottom: 'var(--space-xl)' }}>
        {/* Activity Heatmap */}
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--text-lg)' }}>
            <TrendingUp size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            {t('progress.activity')}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
            {Array.from({ length: 28 }).map((_, i) => {
              const d = new Date();
              d.setDate(d.getDate() - (27 - i));
              const dateStr = d.toISOString().split('T')[0];
              const count = stats.activity_map[dateStr] || 0;
              return (
                <div key={i} title={`${dateStr}: ${count} solved`} style={{
                  aspectRatio: '1',
                  backgroundColor: count > 0 ? 'var(--success)' : 'var(--bg-tertiary)',
                  borderRadius: '3px',
                  opacity: count > 0 ? Math.min(1, 0.4 + (count * 0.15)) : 0.5
                }} />
              );
            })}
          </div>
        </div>

        {/* Weak Topics */}
        <div className="card">
          <h3 style={{ marginBottom: 'var(--space-md)', fontSize: 'var(--text-lg)' }}>
            <BookOpen size={18} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            {t('progress.weakTopics')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {stats.weak_topics.length > 0 ? stats.weak_topics.map((topic, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem', backgroundColor: 'var(--accent-subtle)', borderRadius: 'var(--radius-sm)' }}>
                <BookOpen size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{topic}</span>
              </div>
            )) : (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{t('progress.noWeakTopics')}</p>
            )}
          </div>
        </div>
      </div>

      {/* Activity Chart */}
      <div className="card" style={{ marginBottom: 'var(--space-xl)' }}>
        <h3 style={{ marginBottom: 'var(--space-lg)', fontSize: 'var(--text-lg)' }}>
          {t('progress.activity')}
        </h3>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} />
              <YAxis stroke="var(--text-muted)" fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}
                itemStyle={{ color: 'var(--accent)' }}
              />
              <Line type="monotone" dataKey="solved" name="Questions Solved" stroke="var(--accent)" strokeWidth={2.5} dot={{ r: 3, fill: 'var(--accent)' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
        </>
      )}
    </div>
  );
};
