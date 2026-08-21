import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { Home, PenLine, BookOpen, Clock, BarChart3, Settings, LogOut, Calculator, Menu, X, User } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatInterface } from './components/Chat/ChatInterface';
import { ProgressDashboard } from './components/Dashboard/ProgressDashboard';
import { NCERTQuizPanel } from './components/Quiz/NCERTQuizPanel';
import { GraphPanel } from './components/Graphing/GraphPanel';
import { HomePage } from './components/Home/HomePage';
import { HistoryPanel } from './components/History/HistoryPanel';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { t } from './i18n';

/**
 * Protected route wrapper — allows guest access but redirects to login
 * only when explicitly required (e.g., progress that needs auth).
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode; requireAuth?: boolean }> = ({ children, requireAuth = false }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="loading-spinner" /></div>;
  if (requireAuth && !user) return <Navigate to="/login" />;
  return <>{children}</>;
};

/**
 * Login / Welcome page
 */
const Login: React.FC = () => {
  const { signInWithGoogle, continueAsGuest, user, error } = useAuth();
  const navigate = useNavigate();

  if (user) return <Navigate to="/" />;

  const handleGuest = () => {
    continueAsGuest();
    navigate('/');
  };

  return (
    <div className="login-container">
      <div className="login-mesh" />
      <div className="login-card">
        <div style={{ padding: '1rem', background: 'hsla(var(--accent-primary), 0.1)', borderRadius: '50%', marginBottom: '1.5rem' }}>
          <Calculator size={48} style={{ color: 'hsl(var(--accent-primary))' }} />
        </div>

        <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '0.5rem', letterSpacing: '-0.02em' }}>
          {t('auth.welcome')} <span className="text-gradient">{t('app.name')}</span>
        </h1>

        <p style={{ color: 'hsl(var(--text-secondary))', fontSize: '1.05rem', marginBottom: '2rem' }}>
          {t('auth.subtitle')}
        </p>

        {error && (
          <div style={{ width: '100%', padding: '0.75rem', backgroundColor: 'hsla(0, 84%, 60%, 0.1)', border: '1px solid hsl(var(--danger))', color: 'hsl(var(--danger))', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <button type="button" className="google-btn" onClick={signInWithGoogle}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" />
          {t('auth.continueWithGoogle')}
        </button>

        <button type="button" className="guest-btn" onClick={handleGuest} style={{ marginTop: '0.75rem' }}>
          {t('auth.continueAsGuest')}
        </button>

        <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
          {t('auth.guestNote')}
        </p>

        <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'hsl(var(--text-muted))' }}>
          {t('auth.terms')}
        </div>
      </div>
    </div>
  );
};


/**
 * Sidebar navigation
 */
const Sidebar: React.FC<{ isOpen: boolean; closeMenu: () => void }> = ({ isOpen, closeMenu }) => {
  const { logout, user } = useAuth();

  return (
    <>
      <div className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-logo">
          <Calculator size={24} color="hsl(var(--accent-primary))" />
          <h2>{t('app.name')}</h2>
          {isOpen && (
            <button className="btn btn-ghost" onClick={closeMenu} style={{ marginLeft: 'auto' }} aria-label="Close menu">
              <X size={18} />
            </button>
          )}
        </div>

        <nav aria-label="Main navigation">
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end onClick={closeMenu}>
            <Home size={18} /> {t('nav.home')}
          </NavLink>
          <NavLink to="/solve" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
            <PenLine size={18} /> {t('nav.solve')}
          </NavLink>
          <NavLink to="/practice" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
            <BookOpen size={18} /> {t('nav.practice')}
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
            <Clock size={18} /> {t('nav.history')}
          </NavLink>
          <NavLink to="/progress" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
            <BarChart3 size={18} /> {t('nav.progress')}
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={closeMenu}>
            <Settings size={18} /> {t('nav.settings')}
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          {user && (
            <>
              <div className="sidebar-user">
                <User size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                {user.email || 'Guest'}
              </div>
              <button onClick={() => { closeMenu(); logout(); }} className="nav-link" style={{ color: 'hsl(var(--text-secondary))' }}>
                <LogOut size={18} /> {t('nav.signOut')}
              </button>
            </>
          )}
        </div>
      </div>
      {isOpen && (
        <div className="mobile-menu-overlay" style={{ display: 'block' }} onClick={closeMenu} />
      )}
    </>
  );
};

/**
 * Main application layout with sidebar
 */
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  return (
    <div className="app-container">
      <Sidebar isOpen={isMobileMenuOpen} closeMenu={() => setIsMobileMenuOpen(false)} />
      <div className="main-content">
        {/* Mobile Header */}
        <div className="mobile-header">
          <button className="btn btn-ghost" onClick={() => setIsMobileMenuOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.5rem' }}>
            <Calculator size={20} color="hsl(var(--accent-primary))" />
            <span style={{ fontWeight: 600, fontSize: '1rem' }}>{t('app.name')}</span>
          </div>
        </div>
        {/* Page Content */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </div>
    </div>
  );
};

/**
 * Root Application Component
 */
const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><AppLayout><HomePage /></AppLayout></ProtectedRoute>} />
          <Route path="/solve" element={<ProtectedRoute><AppLayout><ChatInterface /></AppLayout></ProtectedRoute>} />
          <Route path="/practice" element={<ProtectedRoute><AppLayout><NCERTQuizPanel /></AppLayout></ProtectedRoute>} />
          <Route path="/graph" element={<ProtectedRoute><AppLayout><GraphPanel /></AppLayout></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><AppLayout><HistoryPanel /></AppLayout></ProtectedRoute>} />
          <Route path="/progress" element={<ProtectedRoute requireAuth><AppLayout><ProgressDashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><AppLayout><SettingsPanel /></AppLayout></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
