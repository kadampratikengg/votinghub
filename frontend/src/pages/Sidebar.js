import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaChevronLeft,
  FaChevronRight,
  FaTachometerAlt,
  FaCogs,
  FaUserCircle,
  FaCog,
  FaSignOutAlt,
} from 'react-icons/fa';
import './App.css';

const Sidebar = ({ setIsAuthenticated }) => {
  // `isMinimized` controls both desktop and mobile states.
  // true = collapsed (icons only), false = expanded (icons + labels)
  const [isMinimized, setIsMinimized] = useState(true);
  const navigate = useNavigate();
  const role = localStorage.getItem('role') || 'admin';
  const subUserRole = localStorage.getItem('subUserRole') || '';
  const permissions = JSON.parse(localStorage.getItem('permissions') || '[]');
  const canManage =
    role === 'admin' ||
    (role === 'subuser' &&
      (subUserRole === 'admin' || permissions.includes('/manage')));

  const toggleSidebar = () => {
    setIsMinimized((prev) => !prev);
  };

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleLogout = () => {
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
    localStorage.removeItem('role');
    localStorage.removeItem('subUserRole');
    localStorage.removeItem('permissions');
    setIsAuthenticated && setIsAuthenticated(false);
    navigate('/', { replace: true });
  };

  const sidebarClasses = ['sidebar', isMinimized ? 'minimized' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={sidebarClasses}>
      <button
        className='minimize-btn'
        onClick={toggleSidebar}
        aria-label={isMinimized ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {isMinimized ? <FaChevronRight /> : <FaChevronLeft />}
      </button>
      <ul>
        <li>
          <button onClick={() => handleNavigation('/dashboard')}>
            <FaTachometerAlt size={22} />
            {!isMinimized && 'Dashboard'}
          </button>
        </li>
        {canManage && (
          <li>
            <button onClick={() => handleNavigation('/manage')}>
              <FaCogs size={22} />
              {!isMinimized && 'Manage'}
            </button>
          </li>
        )}
        {role === 'admin' && (
          <li>
            <button onClick={() => handleNavigation('/profile')}>
              <FaUserCircle size={22} />
              {!isMinimized && 'Profile'}
            </button>
          </li>
        )}
        {role === 'admin' && (
          <li>
            <button onClick={() => handleNavigation('/settings')}>
              <FaCog size={22} />
              {!isMinimized && 'Settings'}
            </button>
          </li>
        )}
        {/* Uncomment to enable Bids menu
        <li>
          <button onClick={() => handleNavigation('/bids')}>
            <FaGavel size={22} />
            {!isMinimized && 'Bids'}
          </button>
        </li>
        */}
        <li>
          <button onClick={handleLogout}>
            <FaSignOutAlt size={22} />
            {!isMinimized && 'Log Out'}
          </button>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;
