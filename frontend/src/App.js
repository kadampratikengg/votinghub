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
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';

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
            <LoginPage onLogin={handleLogin} />
          )
        }
      />
      <Route path='/create-account' element={<CreateAccountPage />} />
      <Route path='/forgot-password' element={<ForgotPasswordPage />} />
      <Route path='/admin' element={<AdminLogin />} />
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
            <Bids setIsAuthenticated={setIsAuthenticated} />
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
        element={<Start setIsAuthenticated={setIsAuthenticated} />}
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
