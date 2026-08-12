import { useLocation } from 'react-router-dom';
import PublicHeader from './PublicHeader';
import Footer from '../Footer';

const PublicLayout = ({ children }) => {
  const location = useLocation();
  const isLoggedIn =
    typeof window !== 'undefined' &&
    localStorage.getItem('isAuthenticated') === 'true' &&
    !!localStorage.getItem('token');

  const shouldShowHeader = !(location.pathname === '/planspage' && isLoggedIn);

  return (
    <div className='site-shell'>
      {shouldShowHeader ? <PublicHeader /> : null}
      <main className='site-main'>{children}</main>
      <Footer />
    </div>
  );
};

export default PublicLayout;
