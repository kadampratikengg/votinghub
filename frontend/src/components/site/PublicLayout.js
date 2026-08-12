import PublicHeader from './PublicHeader';
import Footer from '../Footer';

const PublicLayout = ({ children }) => (
  <div className='site-shell'>
    <PublicHeader />
    <main className='site-main'>{children}</main>
    <Footer />
  </div>
);

export default PublicLayout;
