import React from 'react';
import { FiMail, FiPhone, FiMapPin } from 'react-icons/fi';
import './MaintenancePage.css'; // Reusing styles
import './ContactPage.css'; // New styles for this page

const ContactPage = () => {
  const supportEmail =
    process.env.REACT_APP_SUPPORT_EMAIL || 'info@privatevoting.in';
  const contactNumber = process.env.REACT_APP_CONTACT_NUMBER || '9404360234';
  const address = 'Satara, 415011, Maharashtra, India';

  return (
    <main className='static-page'>
      <div className='static-page__shell'>
        <section className='static-page__panel'>
          <h1>Contact Us</h1>
          <p>
            We're here to help. Reach out to us with any questions or for
            support.
          </p>

          <hr />

          <div className='contact-layout'>
            <div className='contact-details'>
              <div className='contact-item'>
                <FiMapPin />
                <div>
                  <h4>Our Location</h4>
                  <p>{address}</p>
                </div>
              </div>
              <div className='contact-item'>
                <FiMail />
                <div>
                  <h4>Email</h4>
                  <p>
                    <a href={`mailto:${supportEmail}`}>{supportEmail}</a>
                  </p>
                </div>
              </div>
              <div className='contact-item'>
                <FiPhone />
                <div>
                  <h4>Phone</h4>
                  <p>
                    <a href={`tel:${contactNumber}`}>{contactNumber}</a>
                  </p>
                </div>
              </div>
            </div>
            <div className='contact-map'>
              <iframe
                src='https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d60862.13502834224!2d73.98322368134765!3d17.688733900000004!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3bc239be08d95bbd%3A0x5f447b0a9d54b5b2!2sSatara%2C%20Maharashtra!5e0!3m2!1sen!2sin!4v1670000000000'
                width='100%'
                height='100%'
                style={{ border: 0 }}
                allowFullScreen=''
                loading='lazy'
                referrerPolicy='no-referrer-when-downgrade'
                title='Our Location in Satara'
              ></iframe>
            </div>
          </div>

        
        </section>
      </div>
    </main>
  );
};

export default ContactPage;
