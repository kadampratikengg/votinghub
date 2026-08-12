import { lazy, Suspense, useEffect, useState } from 'react';
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import Footer from './components/Footer';

const LoginPage = lazy(() => import('./components/LoginPage'));
const CreateAccountPage = lazy(() => import('./components/create-account'));
const ForgotPasswordPage = lazy(() => import('./components/forgot-password'));
const ResetPasswordPage = lazy(() => import('./components/reset-password'));
const PlansPage = lazy(() => import('./components/PlansPage'));
const Dashboard = lazy(() => import('./pages/dashboard'));
const Manage = lazy(() => import('./pages/manage'));
const Bids = lazy(() => import('./pages/bids'));
const Settings = lazy(() => import('./pages/settings'));
const Profile = lazy(() => import('./pages/profile'));
const Voting = lazy(() => import('./pages/Voting'));
const Start = lazy(() => import('./pages/start'));
const Result = lazy(() => import('./pages/result'));
const AdminLogin = lazy(() => import('./pages/admin/AdminLogin'));
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));

const HomePage = lazy(() => import('./pages/public/HomePage'));
const FeaturesPage = lazy(() => import('./pages/public/FeaturesPage'));
const SecurityPage = lazy(() => import('./pages/public/SecurityPage'));
const FaqPage = lazy(() => import('./pages/public/FaqPage'));
const AboutUsPage = lazy(() => import('./pages/static/AboutUsPage'));
const ContactPage = lazy(() => import('./pages/static/ContactPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/static/PrivacyPolicyPage'));
const TermsPage = lazy(() => import('./pages/static/TermsPage'));
const CookiePolicyPage = lazy(() => import('./pages/static/CookiePolicyPage'));

const getStoredRole = () => localStorage.getItem('role') || 'admin';
const getStoredSubUserRole = () => localStorage.getItem('subUserRole') || '';
const getStoredPermissions = () => {
  try {
    return JSON.parse(localStorage.getItem('permissions') || '[]');
  } catch (error) {
    return [];
  }
};

const canAccessManage = (role, subUserRole, permissions) =>
  role === 'admin' ||
  (role === 'subuser' &&
    (subUserRole === 'admin' || permissions.includes('/manage')));

const getDefaultPrivateRoute = (role) =>
  role === 'subuser' ? '/dashboard' : '/dashboard';

const hasSession = () =>
  localStorage.getItem('isAuthenticated') === 'true' &&
  !!localStorage.getItem('token');

const hasAdminSession = () => !!localStorage.getItem('companyAdminToken');

const AdminProtectedRoute = ({ children }) => {
  if (!hasAdminSession()) {
    return <Navigate to='/admin' replace />;
  }

  return children;
};

const WithFooter = ({ children }) => (
  <>
    {children}
    <Footer />
  </>
);

const ProtectedRoute = ({ children, allowedRoles, requiredPermissions }) => {
  const location = useLocation();
  const isAuthenticated = hasSession();
  const role = getStoredRole();
  const subUserRole = getStoredSubUserRole();
  const permissions = getStoredPermissions();

  if (!isAuthenticated) {
    return <Navigate to='/login' replace state={{ from: location }} />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to={getDefaultPrivateRoute(role)} replace />;
  }

  if (
    role === 'subuser' &&
    requiredPermissions &&
    requiredPermissions.includes('/manage') &&
    !canAccessManage(role, subUserRole, permissions)
  ) {
    return <Navigate to='/dashboard' replace />;
  }

  if (
    role === 'subuser' &&
    requiredPermissions &&
    requiredPermissions.some((permission) => permission !== '/manage') &&
    !requiredPermissions.every((permission) => permissions.includes(permission))
  ) {
    return <Navigate to='/dashboard' replace />;
  }

  return children;
};

const PublicRedirect = ({ children }) => {
  if (hasSession()) {
    return <Navigate to={getDefaultPrivateRoute(getStoredRole())} replace />;
  }

  return children;
};

const AppRoutes = ({ setIsAuthenticated, handleLogin }) => {
  const role = getStoredRole();
  const defaultPrivateRoute = getDefaultPrivateRoute(role);
  const location = useLocation();

  useEffect(() => {
    // Scroll to top on route change
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0 });
    }
  }, [location.pathname]);

  return (
    <Suspense
      fallback={
        <div
          className='site-shell'
          aria-busy='true'
          style={{
            display: 'grid',
            placeItems: 'center',
            minHeight: '100vh',
            background: 'linear-gradient(180deg, #f8f5ee 0%, #eef4e9 100%)',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '14px',
              textAlign: 'center',
            }}
          >
            <img
              src='/logo512.png'
              alt='PrivateVoting logo'
              style={{
                width: '96px',
                height: '96px',
                borderRadius: '24px',
                objectFit: 'cover',
                boxShadow: '0 18px 40px rgba(31, 122, 77, 0.18)',
                animation: 'pulse 1.8s ease-in-out infinite',
              }}
            />
            <div style={{ color: '#13432c', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              Loading...
            </div>
          </div>
        </div>
      }
    >
      <Routes>
        <Route
          path='/'
          element={
            hasSession() ? (
              <Navigate to={defaultPrivateRoute} replace />
            ) : (
              <HomePage />
            )
          }
        />
        <Route
          path='/login'
          element={
            <PublicRedirect>
              <WithFooter>
                <LoginPage onLogin={handleLogin} />
              </WithFooter>
            </PublicRedirect>
          }
        />
        <Route
          path='/create-account'
          element={
            <PublicRedirect>
              <WithFooter>
                <CreateAccountPage />
              </WithFooter>
            </PublicRedirect>
          }
        />
        <Route
          path='/about-us'
          element={<AboutUsPage />}
        />
        <Route
          path='/features'
          element={<FeaturesPage />}
        />
        <Route
          path='/security'
          element={<SecurityPage />}
        />
        <Route
          path='/pricing'
          element={<PlansPage setIsAuthenticated={setIsAuthenticated} />}
        />
        <Route
          path='/faq'
          element={<FaqPage />}
        />
        <Route
          path='/contact'
          element={<ContactPage />}
        />
        <Route
          path='/privacy-policy'
          element={<PrivacyPolicyPage />}
        />
        <Route
          path='/terms-of-service'
          element={<TermsPage />}
        />
        <Route
          path='/cookie-policy'
          element={<CookiePolicyPage />}
        />
        <Route
          path='/forgot-password'
          element={
            <WithFooter>
              <ForgotPasswordPage />
            </WithFooter>
          }
        />
        <Route
          path='/reset-password/:token'
          element={
            <WithFooter>
              <ResetPasswordPage />
            </WithFooter>
          }
        />
        <Route
          path='/admin'
          element={<AdminLogin />}
        />
        <Route
          path='/admin/dashboard'
          element={
            <AdminProtectedRoute>
              <AdminDashboard />
            </AdminProtectedRoute>
          }
        />
        <Route
          path='/planspage'
          element={<PlansPage setIsAuthenticated={setIsAuthenticated} />}
        />
        <Route
          path='/dashboard'
          element={
            <ProtectedRoute allowedRoles={['admin', 'subuser']}>
              <Dashboard setIsAuthenticated={setIsAuthenticated} />
            </ProtectedRoute>
          }
        />
        <Route
          path='/manage'
          element={
            <ProtectedRoute
              allowedRoles={['admin', 'subuser']}
              requiredPermissions={['/manage']}
            >
              <Manage setIsAuthenticated={setIsAuthenticated} />
            </ProtectedRoute>
          }
        />
        <Route
          path='/bids'
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <WithFooter>
                <Bids setIsAuthenticated={setIsAuthenticated} />
              </WithFooter>
            </ProtectedRoute>
          }
        />
        <Route
          path='/profile'
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Profile setIsAuthenticated={setIsAuthenticated} />
            </ProtectedRoute>
          }
        />
        <Route
          path='/settings'
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Settings setIsAuthenticated={setIsAuthenticated} />
            </ProtectedRoute>
          }
        />
        <Route
          path='/results/:eventId'
          element={
            <ProtectedRoute
              allowedRoles={['admin', 'subuser']}
              requiredPermissions={['/manage']}
            >
              <Result setIsAuthenticated={setIsAuthenticated} />
            </ProtectedRoute>
          }
        />
        <Route
          path='/voting/:eventId'
          element={<Voting setIsAuthenticated={setIsAuthenticated} />}
        />
        <Route
          path='/voting/:eventId/start'
          element={
            <ProtectedRoute
              allowedRoles={['admin', 'subuser']}
              requiredPermissions={['/voting/:eventId']}
            >
              <WithFooter>
                <Start setIsAuthenticated={setIsAuthenticated} />
              </WithFooter>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Suspense>
  );
};

const App = () => {
  const [, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(hasSession());
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    localStorage.setItem('isAuthenticated', 'true');
  };

  return (
    <HelmetProvider>
      <Router>
        <div className='App'>
          <AppRoutes
            setIsAuthenticated={setIsAuthenticated}
            handleLogin={handleLogin}
          />
        </div>
      </Router>
    </HelmetProvider>
  );
};

export default App;
