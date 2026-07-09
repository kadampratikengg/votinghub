import { Link } from 'react-router-dom';
import { FiClock, FiTool, FiArrowLeft } from 'react-icons/fi';
import './MaintenancePage.css';

const MaintenancePage = ({ title, description, note, primaryLabel }) => {
  return (
    <main className='static-page'>
      <div className='static-page__shell'>
        <section className='static-page__panel'>
          <span className='static-page__badge'>
            <FiTool /> Under maintenance
          </span>
          <h1>{title}</h1>
          <p>{description}</p>

          <div className='static-page__status'>
            <strong>
              <FiClock /> Maintenance in progress
            </strong>
            <span>{note}</span>
          </div>

          <div className='static-page__actions'>
            <Link to='/' className='static-page__button'>
              <FiArrowLeft /> {primaryLabel || 'Back to Home'}
            </Link>
            <Link to='/create-account' className='static-page__link'>
              Create account
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
};

export default MaintenancePage;
