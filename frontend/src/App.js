import React, { useState, useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import LoginPage from './components/LoginPage';
import CreateAccountPage from './components/create-account';
import ForgotPasswordPage from './components/forgot-password';
import Dashboard from './pages/dashboard';
import Manage from './pages/manage';
import Bids from './pages/bids';
import Settings from './pages/settings';
import Profile from './pages/profile';
import Voting from './pages/Voting';
import Start from './pages/start';
import Result from './pages/result';
import PlansPage from './components/PlansPage';
import Footer from './components/Footer';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AboutUsPage from './pages/static/AboutUsPage';
import ContactPage from './pages/static/ContactPage';
import SupportPage from './pages/static/SupportPage';
import PrivacyPolicyPage from './pages/static/PrivacyPolicyPage';
import TermsPage from './pages/static/TermsPage';
import CookiePolicyPage from './pages/static/CookiePolicyPage';

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
    return <Navigate to='/' replace state={{ from: location }} />;
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

const AppRoutes = ({ isAuthenticated, setIsAuthenticated, handleLogin }) => {
  const role = getStoredRole();
  const defaultPrivateRoute = getDefaultPrivateRoute(role);

  return (
    <Routes>
      <Route
        path='/'
        element={
          isAuthenticated ? (
            <Navigate to={defaultPrivateRoute} replace />
          ) : (
            <WithFooter>
              <LoginPage onLogin={handleLogin} />
            </WithFooter>
          )
        }
      />
      <Route
        path='/create-account'
        element={
          <WithFooter>
            <CreateAccountPage />
          </WithFooter>
        }
      />
      <Route
        path='/about-us'
        element={
          <WithFooter>
            <AboutUsPage />
          </WithFooter>
        }
      />
      <Route
        path='/contact'
        element={
          <WithFooter>
            <ContactPage />
          </WithFooter>
        }
      />
      <Route
        path='/support'
        element={
          <WithFooter>
            <SupportPage />
          </WithFooter>
        }
      />
      <Route
        path='/privacy-policy'
        element={
          <WithFooter>
            <PrivacyPolicyPage />
          </WithFooter>
        }
      />
      <Route
        path='/terms-of-service'
        element={
          <WithFooter>
            <TermsPage />
          </WithFooter>
        }
      />
      <Route
        path='/cookie-policy'
        element={
          <WithFooter>
            <CookiePolicyPage />
          </WithFooter>
        }
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
        path='/admin'
        element={
           <AdminLogin />
          // <WithFooter>
          //   <AdminLogin />
          // </WithFooter>
        }
      />
      <Route
        path='/admin/dashboard'
        element={
          <AdminProtectedRoute>
            {/* <WithFooter> */}
              <AdminDashboard />
            {/* </WithFooter> */}
          </AdminProtectedRoute>
        }
      />
      <Route
        path='/planspage'
        element={
          <WithFooter>
            <PlansPage setIsAuthenticated={setIsAuthenticated} />
          </WithFooter>
        }
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
            {/* <WithFooter> */}
              <Result setIsAuthenticated={setIsAuthenticated} />
            {/* </WithFooter> */}
          </ProtectedRoute>
        }
      />

      <Route
        path='/voting/:eventId'
        element={
          // <WithFooter>
            <Voting setIsAuthenticated={setIsAuthenticated} />
          // </WithFooter>
        }
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
  );
};

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    setIsAuthenticated(hasSession());
  }, []);

  const handleLogin = () => {
    setIsAuthenticated(true);
    localStorage.setItem('isAuthenticated', 'true');
  };

  return (
    <Router>
      <div className='App'>
        <AppRoutes
          isAuthenticated={isAuthenticated}
          setIsAuthenticated={setIsAuthenticated}
          handleLogin={handleLogin}
        />
      </div>
    </Router>
  );
};

export default App;
