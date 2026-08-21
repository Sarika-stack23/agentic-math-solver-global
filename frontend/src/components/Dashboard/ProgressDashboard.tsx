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
        } else {
          setStats({ streak: 0, total_solved: 0, accuracy: 0, weak_topics: [], activity_map: {} });
        }
      } catch (err) {
        console.error("Failed to fetch progress", err);
        setStats({ streak: 0, total_solved: 0, accuracy: 0, weak_topics: [], activity_map: {} });
      }
    };
    fetchProgress();
  }, [user, apiUrl]);

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

      {/* Stat Cards */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-xl)' }}>
        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'hsla(38, 92%, 50%, 0.1)', color: 'hsl(var(--warning))' }}>
            <Flame size={28} />
          </div>
          <div>
            <div className="stat-label">{t('progress.streak')}</div>
            <div className="stat-value">{stats.streak} <span style={{ fontSize: '0.9rem', fontWeight: 400 }}>{t('progress.days')}</span></div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'hsla(217, 91%, 60%, 0.1)', color: 'hsl(var(--accent-primary))' }}>
            <Trophy size={28} />
          </div>
          <div>
            <div className="stat-label">{t('progress.totalSolved')}</div>
            <div className="stat-value">{stats.total_solved}</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'hsla(142, 76%, 36%, 0.1)', color: 'hsl(var(--success))' }}>
            <CheckCircle size={28} />
          </div>
          <div>
            <div className="stat-label">{t('progress.accuracy')}</div>
            <div className="stat-value">{stats.accuracy}%</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon" style={{ backgroundColor: 'hsla(280, 70%, 60%, 0.1)', color: 'hsl(var(--accent-secondary))' }}>
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
                  backgroundColor: count > 0 ? 'hsl(var(--success))' : 'hsl(var(--bg-tertiary))',
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
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem', backgroundColor: 'hsla(var(--accent-primary), 0.08)', borderRadius: 'var(--radius-sm)' }}>
                <BookOpen size={16} style={{ color: 'hsl(var(--accent-primary))', flexShrink: 0 }} />
                <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{topic}</span>
              </div>
            )) : (
              <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '0.9rem' }}>{t('progress.noWeakTopics')}</p>
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
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--text-muted))" fontSize={12} />
              <YAxis stroke="hsl(var(--text-muted))" fontSize={12} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: 'hsl(var(--bg-elevated))', border: '1px solid hsl(var(--border))', borderRadius: 'var(--radius)', fontSize: '0.85rem' }}
                itemStyle={{ color: 'hsl(var(--accent-primary))' }}
              />
              <Line type="monotone" dataKey="solved" name="Questions Solved" stroke="hsl(var(--accent-primary))" strokeWidth={2.5} dot={{ r: 3, fill: 'hsl(var(--accent-primary))' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
