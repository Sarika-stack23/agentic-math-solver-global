import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Home, PenLine, BookOpen, Clock, BarChart3, Settings, LogOut, Calculator, Menu, X, User } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ChatInterface } from './components/Chat/ChatInterface';
import { ProgressDashboard } from './components/Dashboard/ProgressDashboard';
import { GlobalPracticePanel } from './components/Quiz/GlobalPracticePanel';
import { GraphPanel } from './components/Graphing/GraphPanel';
import { HomePage } from './components/Home/HomePage';
import { HistoryPanel } from './components/History/HistoryPanel';
import { SettingsPanel } from './components/Settings/SettingsPanel';
import { t } from './i18n';

/**
 * Protected route wrapper — allows guest access but redirects to login
 * only when explicitly required (e.g., progress that needs auth).
 */
const ProtectedRoute: React.FC<{ children: React.ReactNode; requireAuth?: boolean }> = ({ children, requireAuth = true }) => {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}><div className="loading-spinner" /></div>;
  if (requireAuth && !user) return <Navigate to="/login" />;
  return <>{children}</>;
};

const Login: React.FC = () => {
  const { signInWithGoogle, signInWithEmail, signUpWithEmail, user, error: authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [localError, setLocalError] = useState('');

  if (user) return <Navigate to="/" />;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!email || !password) {
      setLocalError('Please enter email and password');
      return;
    }
    if (isSignUp) {
      await signUpWithEmail(email, password);
    } else {
      await signInWithEmail(email, password);
    }
  };

  const error = localError || authError;

  return (
    <div className="login-container">
      <div className="login-mesh" />
      <div className="login-card">
        <div className="icon-badge animate-float" style={{ width: 72, height: 72, borderRadius: 20, marginBottom: '1.5rem' }}>
          <Calculator size={36} color="white" />
        </div>

        <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '0.5rem', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
          {t('auth.welcome')} <span className="text-gradient">{t('app.name')}</span>
        </h1>

        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginBottom: '1.5rem' }}>
          {t('auth.subtitle')}
        </p>

        {error && (
          <div style={{ width: '100%', padding: '0.75rem', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleEmailSubmit} style={{ width: '100%', marginBottom: '1rem' }}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', marginBottom: '0.5rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface-light)', color: 'var(--text)' }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: '0.75rem', marginBottom: '1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--surface-light)', color: 'var(--text)' }}
          />
          <button type="submit" className="google-btn" style={{ background: 'var(--primary)', color: 'white', border: 'none' }}>
            {isSignUp ? 'Sign Up' : 'Log In'}
          </button>
        </form>

        <div style={{ marginBottom: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button type="button" onClick={() => setIsSignUp(!isSignUp)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', textDecoration: 'underline' }}>
            {isSignUp ? 'Log In' : 'Sign Up'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', width: '100%', marginBottom: '1rem' }}>
          <hr style={{ flex: 1, borderColor: 'var(--border)' }} />
          <span style={{ margin: '0 10px', color: 'var(--text-muted)' }}>or</span>
          <hr style={{ flex: 1, borderColor: 'var(--border)' }} />
        </div>

        <button type="button" className="google-btn" onClick={signInWithGoogle}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" />
          {t('auth.continueWithGoogle')}
        </button>

        <div style={{ marginTop: '2rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
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
          <div className="icon-badge">
            <Calculator size={18} color="white" />
          </div>
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
              <button onClick={() => { closeMenu(); logout(); }} className="nav-link" style={{ color: 'var(--text-secondary)' }}>
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
            <div className="icon-badge" style={{ width: 28, height: 28, borderRadius: 8 }}>
              <Calculator size={14} color="white" />
            </div>
            <span className="text-gradient" style={{ fontWeight: 700, fontSize: '1rem' }}>{t('app.name')}</span>
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
          <Route path="/practice" element={<ProtectedRoute><AppLayout><GlobalPracticePanel /></AppLayout></ProtectedRoute>} />
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
