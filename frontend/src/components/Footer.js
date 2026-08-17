import { FiFacebook, FiLinkedin, FiX, FiYoutube } from 'react-icons/fi';
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
            <div className='site-footer__social' aria-label='Social links'>
              <a href='https://www.linkedin.com' target='_blank' rel='noreferrer' aria-label='LinkedIn'>
                <FiLinkedin />
              </a>
              <a href='https://www.facebook.com/share/1LThatW4Gk/?mibextid=wwXIfr' target='_blank' rel='noreferrer' aria-label='Facebook'>
                <FiFacebook />
              </a>
              <a href='https://x.com' target='_blank' rel='noreferrer' aria-label='X'>
                <FiX />
              </a>
              <a href='https://www.youtube.com/@PrivateVoting' target='_blank' rel='noreferrer' aria-label='YouTube'>
                <FiYoutube />
              </a>
            </div>
          </div>

          <div>
            <h3 className='site-footer__heading'>About</h3>
            <ul className='site-footer__links'>
              <li>
                <a href='/about-us'>About Us</a>
              </li>
              <li>
                <a href='/features'>Features</a>
              </li>
              <li>
                <a href='/pricing'>Pricing</a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className='site-footer__heading'>Explore</h3>
            <ul className='site-footer__links'>
              <li>
                <a href='/contact'>Contact</a>
              </li>
              <li>
                <a href='/faq'>FAQ</a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className='site-footer__heading'>Legal</h3>
            <ul className='site-footer__links'>
              <li>
                <a href='/privacy-policy'>Privacy Policy</a>
              </li>
              <li>
                <a href='/terms-of-service'>Terms of Service</a>
              </li>
              <li>
                <a href='/cookie-policy'>Cookie Policy</a>
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
