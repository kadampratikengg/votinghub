import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FaBars,
  FaCalendarAlt,
  FaChartBar,
  FaPlusCircle,
  FaRegUserCircle,
  FaSignOutAlt,
  FaSlidersH,
  FaTachometerAlt,
  FaUsers,
} from 'react-icons/fa';
import './App.css';

const Sidebar = ({ setIsAuthenticated }) => {
  const [isMinimized, setIsMinimized] = useState(() => {
    if (typeof window === 'undefined') return false;

    const savedPreference = localStorage.getItem('sidebarMinimized');
    return savedPreference === null
      ? window.innerWidth <= 768
      : savedPreference === 'true';
  });
  const navigate = useNavigate();
  const location = useLocation();
  const role = localStorage.getItem('role') || 'admin';
  const subUserRole = localStorage.getItem('subUserRole') || '';
  const permissions = JSON.parse(localStorage.getItem('permissions') || '[]');
  const canManage =
    role === 'admin' ||
    (role === 'subuser' &&
      (subUserRole === 'admin' || permissions.includes('/manage')));

  const toggleSidebar = () => {
    setIsMinimized((prev) => {
      const next = !prev;
      localStorage.setItem('sidebarMinimized', String(next));
      return next;
    });
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
  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: <FaTachometerAlt /> },
    canManage && {
      label: 'Manage',
      path: '/manage',
      icon: <FaCalendarAlt />,
    },
    canManage && {
      label: 'Create Event',
      path: '/create-event',
      icon: <FaPlusCircle />,
    },
    canManage && { label: 'Voters', path: '/voters', icon: <FaUsers /> },
    canManage && {
      label: 'Results',
      path: '/results',
      icon: <FaChartBar />,
    },
    role === 'admin' && {
      label: 'Settings',
      path: '/settings',
      icon: <FaSlidersH />,
    },
    role === 'admin' && {
      label: 'Profile',
      path: '/profile',
      icon: <FaRegUserCircle />,
    },
  ].filter(Boolean);

  return (
    <div className={sidebarClasses}>
      <div className='sidebar-header'>
        <div className='sidebar-brand'>
          <img src='/logo512.png' alt='Private Voting' />
          {!isMinimized && (
            <span>
              <strong>Private</strong>
              <strong>Voting</strong>
            </span>
          )}
        </div>
        <button
          className='minimize-btn'
          onClick={toggleSidebar}
          aria-label={isMinimized ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <FaBars />
        </button>
      </div>
      <ul className='sidebar-nav'>
        {navItems.map((item) => (
          <li key={item.label}>
            <button
              className={location.pathname === item.path ? 'active' : ''}
              onClick={() => handleNavigation(item.path)}
              title={item.label}
            >
              {item.icon}
              {!isMinimized && <span>{item.label}</span>}
            </button>
          </li>
        ))}
        <li>
          <button onClick={handleLogout} title='Logout'>
            <FaSignOutAlt />
            {!isMinimized && <span>Logout</span>}
          </button>
        </li>
      </ul>
    </div>
  );
};

export default Sidebar;
