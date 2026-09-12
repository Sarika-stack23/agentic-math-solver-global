import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Home, PenLine, BookOpen, Clock, BarChart3, Settings, LogOut, Sigma, Menu, X, Moon, Sun } from 'lucide-react';
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
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  // Map raw Firebase errors to friendly messages
  const getFriendlyError = (err: string) => {
    if (!err) return '';
    const errStr = err.toLowerCase();
    if (errStr.includes('invalid-credential') || errStr.includes('user-not-found') || errStr.includes('wrong-password')) {
      return 'Invalid email or password. Please try again.';
    }
    if (errStr.includes('email-already-in-use')) {
      return 'An account with this email already exists.';
    }
    if (errStr.includes('weak-password')) {
      return 'Password should be at least 6 characters.';
    }
    if (errStr.includes('network-request-failed')) {
      return 'Network error. Please check your connection and try again.';
    }
    // Fallback for unknown errors (strip Firebase prefix if present)
    return err.replace(/^FirebaseError:\s*/i, '') || 'Authentication failed. Please try again.';
  };

  if (user) return <Navigate to="/" />;

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    if (!email || !password) {
      setLocalError('Please enter email and password.');
      return;
    }

    setIsAuthenticating(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password);
      } else {
        await signInWithEmail(email, password);
      }
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleGoogleSubmit = async () => {
    setIsAuthenticating(true);
    try {
      await signInWithGoogle();
    } finally {
      setIsAuthenticating(false);
    }
  };

  const rawError = localError || authError;
  const error = rawError ? getFriendlyError(rawError) : null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      {/* Left Column: Form */}
      <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', padding: '2rem', background: 'var(--bg-primary)', position: 'relative', zIndex: 1 }}>

        {/* Top Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: 'auto' }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sigma size={22} color="white" />
          </div>
          <span style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            {t('app.name')}
          </span>
        </div>

        {/* Form Container */}
        <div style={{ maxWidth: '420px', width: '100%', margin: '0 auto' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '0.5rem', letterSpacing: '-0.03em', color: 'var(--text-primary)' }}>
            Welcome back
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', marginBottom: '2.5rem' }}>
            Log in to your workspace or create a new account to start solving.
          </p>

            {error && (
              <div className="animate-fade-in" style={{ width: '100%', padding: '1rem', backgroundColor: 'var(--danger-bg, rgba(239, 68, 68, 0.1))', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '12px', marginBottom: '1.5rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.1)' }}>
                <span style={{ fontWeight: 600 }}>Error:</span> {error}
              </div>
            )}

            <form onSubmit={handleEmailSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginBottom: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Email address</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface-light)', color: 'var(--text-primary)', fontSize: '1rem', transition: 'all 0.2s', outline: 'none', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 4px rgba(99, 102, 241, 0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)'; }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface-light)', color: 'var(--text-primary)', fontSize: '1rem', transition: 'all 0.2s', outline: 'none', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 4px rgba(99, 102, 241, 0.1)'; }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)'; }}
                />
              </div>
              <button type="submit" disabled={isAuthenticating} style={{ width: '100%', padding: '0.875rem', marginTop: '0.5rem', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '1rem', fontWeight: 600, cursor: isAuthenticating ? 'not-allowed' : 'pointer', opacity: isAuthenticating ? 0.7 : 1, transition: 'transform 0.1s, opacity 0.2s, box-shadow 0.2s', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)' }}
                onMouseOver={(e) => { if (!isAuthenticating) { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(99, 102, 241, 0.3)'; } }}
                onMouseOut={(e) => { if (!isAuthenticating) { e.currentTarget.style.opacity = '1'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.25)'; } }}
                onMouseDown={(e) => { if (!isAuthenticating) e.currentTarget.style.transform = 'scale(0.98)'; }}
                onMouseUp={(e) => { if (!isAuthenticating) e.currentTarget.style.transform = 'scale(1)'; }}
              >
              {isAuthenticating && <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderColor: 'rgba(255,255,255,0.3)', borderTopColor: 'white' }} />}
              {isAuthenticating ? (isSignUp ? 'Creating account...' : 'Signing in...') : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>

          <div style={{ display: 'flex', alignItems: 'center', margin: '2rem 0' }}>
            <hr style={{ flex: 1, borderColor: 'var(--border)', borderTop: 'none' }} />
            <span style={{ margin: '0 1rem', color: 'var(--text-muted)', fontSize: '0.9rem', fontWeight: 500 }}>OR CONTINUE WITH</span>
            <hr style={{ flex: 1, borderColor: 'var(--border)', borderTop: 'none' }} />
          </div>

          <button type="button" disabled={isAuthenticating} onClick={handleGoogleSubmit} style={{ width: '100%', padding: '0.875rem', background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '12px', fontSize: '1rem', fontWeight: 500, fontFamily: '"Google Sans", Roboto, Arial, sans-serif', cursor: isAuthenticating ? 'not-allowed' : 'pointer', opacity: isAuthenticating ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', transition: 'all 0.2s ease', boxShadow: 'var(--shadow-sm)' }}
            onMouseOver={(e) => {
              if (isAuthenticating) return;
              e.currentTarget.style.borderColor = 'var(--border-glow)';
              e.currentTarget.style.boxShadow = '0 0 12px rgba(99, 102, 241, 0.2)';
            }}
            onMouseOut={(e) => {
              if (isAuthenticating) return;
              e.currentTarget.style.borderColor = 'var(--border)';
              e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
          >
            {isAuthenticating ? (
              <div className="loading-spinner" style={{ width: '16px', height: '16px', borderWidth: '2px', borderColor: 'var(--border)', borderTopColor: 'var(--text-primary)' }} />
            ) : (
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google logo" style={{ width: '20px' }} />
            )}
            Continue with Google
          </button>

          <div style={{ textAlign: 'center', marginTop: '2.5rem', fontSize: '0.95rem', color: 'var(--text-secondary)' }}>
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button type="button" data-testid="auth-toggle" onClick={() => setIsSignUp(!isSignUp)} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 600, cursor: 'pointer', padding: 0 }}>
              {isSignUp ? 'Sign in instead' : 'Create one now'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          By continuing, you agree to our Terms of Service & Privacy Policy.
        </div>
      </div>

      {/* Right Column: Hero Graphic (Desktop Only) */}
      <div className="desktop-only" style={{ flex: '1 1 50%', background: 'linear-gradient(135deg, var(--bg-elevated) 0%, var(--bg-primary) 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', position: 'relative', overflow: 'hidden', borderLeft: '1px solid var(--border)' }}>

        {/* Decorative Math Elements */}
        <div style={{ position: 'absolute', top: '10%', left: '10%', opacity: 0.05, fontSize: '10rem', fontWeight: 'bold', fontFamily: 'serif', pointerEvents: 'none', color: 'var(--text-primary)' }}>∫</div>
        <div style={{ position: 'absolute', bottom: '15%', right: '15%', opacity: 0.05, fontSize: '12rem', fontWeight: 'bold', fontFamily: 'serif', pointerEvents: 'none', color: 'var(--text-primary)' }}>∑</div>
        <div style={{ position: 'absolute', top: '40%', right: '5%', opacity: 0.05, fontSize: '8rem', fontWeight: 'bold', fontFamily: 'serif', pointerEvents: 'none', color: 'var(--text-primary)' }}>π</div>

        <div style={{ maxWidth: '500px', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', padding: '0.5rem 1rem', background: 'var(--primary)', color: 'white', borderRadius: '9999px', fontSize: '0.85rem', fontWeight: 600, letterSpacing: '0.05em', marginBottom: '1.5rem', textTransform: 'uppercase' }}>
            Advanced Engine
          </div>
          <h2 style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1.1, marginBottom: '1.5rem', color: 'var(--text-primary)', letterSpacing: '-0.03em' }}>
            Master Mathematics <br/>
            <span style={{ color: 'var(--primary)' }}>Symbolically.</span>
          </h2>
          <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '3rem' }}>
            Stop struggling with syntax. Upload a photo, write an equation, or ask a question. Get step-by-step verified proofs and instantly practice the concepts you missed.
          </p>

          <div style={{ display: 'flex', gap: '2rem' }}>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>100%</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500, marginTop: '0.25rem' }}>Step-by-Step Verified</div>
            </div>
            <div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)' }}>Multi</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: 500, marginTop: '0.25rem' }}>Modal Inputs (Img, PDF)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


/**
 * Top Navigation Bar
 */
const TopNav: React.FC = () => {
  const { logout, user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    return document.documentElement.getAttribute('data-theme') !== 'light';
  });

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    setIsDark(!isDark);
  };

  return (
    <header className="top-nav">
      <div className="top-nav-container">
        <div className="top-nav-brand">
          <div className="icon-badge" style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sigma size={20} color="white" />
          </div>
          <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: 800, color: 'var(--text-primary)' }}>
            {t('app.name')}
          </h2>
        </div>

        {/* Desktop Navigation */}
        <nav className="top-nav-links desktop-only">
          <NavLink to="/" className={({ isActive }) => `nav-link-top ${isActive ? 'active' : ''}`} end>
             {t('nav.home')}
          </NavLink>
          <NavLink to="/solve" className={({ isActive }) => `nav-link-top ${isActive ? 'active' : ''}`}>
             {t('nav.solve')}
          </NavLink>
          <NavLink to="/practice" className={({ isActive }) => `nav-link-top ${isActive ? 'active' : ''}`}>
             {t('nav.practice')}
          </NavLink>
          <NavLink to="/history" className={({ isActive }) => `nav-link-top ${isActive ? 'active' : ''}`}>
             {t('nav.history')}
          </NavLink>
          <NavLink to="/progress" className={({ isActive }) => `nav-link-top ${isActive ? 'active' : ''}`}>
             {t('nav.progress')}
          </NavLink>
        </nav>

        <div className="top-nav-actions desktop-only">
          <button onClick={toggleTheme} className="icon-btn" title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <NavLink to="/settings" className="icon-btn" aria-label={t('nav.settings')}>
            <Settings size={20} />
          </NavLink>
          {user && (
            <button onClick={logout} data-testid="sign-out-btn" className="icon-btn" title={t('nav.signOut')}>
              <LogOut size={20} />
            </button>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button className="mobile-only icon-btn" onClick={() => setMenuOpen(!menuOpen)} aria-label="Open menu">
          {menuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Menu Dropdown */}
      {menuOpen && (
        <div className="mobile-menu">
          <NavLink to="/" className="nav-link" onClick={() => setMenuOpen(false)} end><Home size={18}/> {t('nav.home')}</NavLink>
          <NavLink to="/solve" className="nav-link" onClick={() => setMenuOpen(false)}><PenLine size={18}/> {t('nav.solve')}</NavLink>
          <NavLink to="/practice" className="nav-link" onClick={() => setMenuOpen(false)}><BookOpen size={18}/> {t('nav.practice')}</NavLink>
          <NavLink to="/history" className="nav-link" onClick={() => setMenuOpen(false)}><Clock size={18}/> {t('nav.history')}</NavLink>
          <NavLink to="/progress" className="nav-link" onClick={() => setMenuOpen(false)}><BarChart3 size={18}/> {t('nav.progress')}</NavLink>
          <NavLink to="/settings" className="nav-link" onClick={() => setMenuOpen(false)}><Settings size={18}/> {t('nav.settings')}</NavLink>
          <button className="nav-link" onClick={() => { toggleTheme(); setMenuOpen(false); }}>
            {isDark ? <Sun size={18}/> : <Moon size={18}/>} {isDark ? 'Light Mode' : 'Dark Mode'}
          </button>
          {user && <button data-testid="sign-out-btn-mobile" className="nav-link" onClick={() => { logout(); setMenuOpen(false); }}><LogOut size={18}/> {t('nav.signOut')}</button>}
        </div>
      )}
    </header>
  );
};

/**
 * Main application layout with Top Nav
 */
const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="app-container">
      <TopNav />
      <div className="main-content">
        <div className="content-wrapper">
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
