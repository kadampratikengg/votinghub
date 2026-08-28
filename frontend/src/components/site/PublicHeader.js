import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { FiMenu, FiX } from 'react-icons/fi';
import BrandMark from './BrandMark';

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Features', to: '/features' },
  { label: 'Security', to: '/security' },
  { label: 'Pricing', to: '/pricing' },
  { label: 'FAQ', to: '/faq' },
  { label: 'Contact', to: '/contact' },
];

const PublicHeader = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 920) {
        setMenuOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <header className='site-nav'>
      <div className='site-container'>
        <div className='site-nav__inner'>
          <Link to='/' className='site-brand' onClick={closeMenu}>
            <BrandMark />
          </Link>

          <nav className='site-nav__links' aria-label='Primary navigation'>
            {navLinks.map((link) => (
              <NavLink key={link.to} to={link.to} onClick={closeMenu}>
                {link.label}
              </NavLink>
            ))}
          </nav>

          <div className='site-nav__actions'>
            <Link to='/login' className='site-button--ghost'>
              Login
            </Link>
            <Link to='/create-account' className='site-button'>
              Get Started
            </Link>
          </div>

          <button
            type='button'
            className='site-nav__toggle'
            aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <FiX /> : <FiMenu />}
          </button>
        </div>

        <div className='site-nav__mobile-panel' aria-hidden={!menuOpen}>
          <nav className='site-nav__mobile-links' aria-label='Mobile navigation'>
            {navLinks.map((link) => (
              <NavLink key={link.to} to={link.to} onClick={closeMenu}>
                {link.label}
              </NavLink>
            ))}
            <Link to='/login' onClick={closeMenu}>
              Login
            </Link>
            <Link to='/create-account' onClick={closeMenu}>
              Get Started
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
};

export default PublicHeader;
