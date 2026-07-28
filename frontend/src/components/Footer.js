import React from 'react';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const brandName = process.env.REACT_APP_BRAND_NAME || 'PrivateVoting';
  const supportEmail =
    process.env.REACT_APP_SUPPORT_EMAIL || 'info@privatevoting.in';

  return (
    <footer className='footer'>
      <div className='footer-content'>
        <div className='footer-section footer-section--brand'>
          <h4 className='footer-brand'>{brandName}</h4>
          <p className='footer-description'>
            Secure digital voting platform for elections, governance, and
            organizational decisions.
          </p>
        </div>

        <div className='footer-section'>
          <h5 className='footer-title'>Quick Links</h5>
          <ul className='footer-links'>
            <li>
              <a href='/'>Home</a>
            </li>
            <li>
              <a href='/about-us'>About Us</a>
            </li>
            <li>
              <a href='/contact'>Contact</a>
            </li>
            
          </ul>
        </div>

        <div className='footer-section'>
          <h5 className='footer-title'>Legal</h5>
          <ul className='footer-links'>
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

        <div className='footer-section'>
          <h5 className='footer-title'>Contact</h5>
          <p className='footer-contact'>
            Email: <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
          </p>
        </div>
      </div>

      <div className='footer-bottom'>
        <p>
          &copy; {currentYear} {brandName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
