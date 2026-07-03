import React from 'react';
import './Footer.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className='footer'>
      <div className='footer-content'>
        <div className='footer-section'>
          <h4 className='footer-brand'>PrivateVoting</h4>
          <p className='footer-description'>
            Secure digital voting platform for democratic elections and
            organizational decisions.
          </p>
        </div>

        <div className='footer-section'>
          <h5 className='footer-title'>Quick Links</h5>
          <ul className='footer-links'>
            <li>
              <a href='#'>Home</a>
            </li>
            <li>
              <a href='#'>About Us</a>
            </li>
            <li>
              <a href='#'>Contact</a>
            </li>
            <li>
              <a href='#'>Support</a>
            </li>
          </ul>
        </div>

        <div className='footer-section'>
          <h5 className='footer-title'>Legal</h5>
          <ul className='footer-links'>
            <li>
              <a href='#'>Privacy Policy</a>
            </li>
            <li>
              <a href='#'>Terms of Service</a>
            </li>
            <li>
              <a href='#'>Cookie Policy</a>
            </li>
          </ul>
        </div>

        <div className='footer-section'>
          <h5 className='footer-title'>Contact</h5>
          <p className='footer-contact'>
            Email:{' '}
            <a href='mailto:info@privatevoting.in'>info@privatevoting.in</a>
          </p>
          <p className='footer-contact'>
            Website:{' '}
            <a
              href='https://privatevoting.in'
              target='_blank'
              rel='noopener noreferrer'
            >
              privatevoting.in
            </a>
          </p>
        </div>
      </div>

      <div className='footer-bottom'>
        <p>
          &copy; {currentYear} PrivateVoting. All rights reserved. |{' '}
          <a href='#'>Privacy</a> | <a href='#'>Terms</a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
