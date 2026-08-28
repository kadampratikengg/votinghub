import { Link } from 'react-router-dom';
import { FiFacebook, FiInstagram, FiX, FiYoutube } from 'react-icons/fi';
import BrandMark from './site/BrandMark';
import '../styles/public.css';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  return (
    <footer className='site-footer'>
      <div className='site-container'>
        <div className='site-footer__grid'>
          <div>
            <BrandMark />
            <p className='site-footer__description'>
              PrivateVoting is a secure digital voting platform for elections,
              governance, and organizational decision-making across India and
              beyond.
            </p>
            <div className='site-footer__social' aria-label='Social media links'>
              <a
                href='https://www.instagram.com/privatevoting?igsh=MWliNmdpajhqZmhndg%3D%3D&igsi=MWliNmdpajhqZmhndg%3D%3D&utm_source=qr'
                target='_blank'
                rel='noopener noreferrer'
                aria-label='Follow PrivateVoting on Instagram'
              >
                <FiInstagram />
              </a>
              <a
                href='https://www.facebook.com/share/1LThatW4Gk/?mibextid=wwXIfr'
                target='_blank'
                rel='noopener noreferrer'
                aria-label='Follow PrivateVoting on Facebook'
              >
                <FiFacebook />
              </a>
              <a
                href='https://x.com/PrivateVoting?s=20'
                target='_blank'
                rel='noopener noreferrer'
                aria-label='Follow PrivateVoting on X'
              >
                <FiX />
              </a>
              <a
                href='https://www.youtube.com/@PrivateVoting'
                target='_blank'
                rel='noopener noreferrer'
                aria-label='Subscribe to PrivateVoting on YouTube'
              >
                <FiYoutube />
              </a>
            </div>
          </div>

          <div>
            <h3 className='site-footer__heading'>About</h3>
            <ul className='site-footer__links'>
              <li>
                <Link to='/about-us'>About Us</Link>
              </li>
              <li>
                <Link to='/features'>Features</Link>
              </li>
              <li>
                <Link to='/pricing'>Pricing</Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className='site-footer__heading'>Explore</h3>
            <ul className='site-footer__links'>
              <li>
                <Link to='/contact'>Contact</Link>
              </li>
              <li>
                <Link to='/faq'>FAQ</Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className='site-footer__heading'>Legal</h3>
            <ul className='site-footer__links'>
              <li>
                <Link to='/privacy-policy'>Privacy Policy</Link>
              </li>
              <li>
                <Link to='/terms-of-service'>Terms of Service</Link>
              </li>
              <li>
                <Link to='/cookie-policy'>Cookie Policy</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className='site-footer__bottom'>
          <span>
            &copy; {currentYear} PrivateVoting. All rights reserved.
          </span>
          <span>Secure online voting platform</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
