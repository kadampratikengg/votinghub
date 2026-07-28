import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import './MaintenancePage.css'; // Reusing styles for consistency

const CookiePolicyPage = () => (
  <main className='static-page'>
    <div className='static-page__shell'>
      <section className='static-page__panel'>
        <h1>COOKIE POLICY</h1>
        <p>
          <strong>Last Updated:</strong> 26 November 2023
        </p>
        <p>
          <strong>Effective Date:</strong> 26 November 2023
        </p>
        <p>
          This Cookie Policy explains how <strong>[Private Voting]</strong>{' '}
          ("Company", "we", "us", or "our") uses cookies and similar 
          technologies when you access or use our website, SaaS platform,
          applications, products, and related services (collectively, the{' '}
          <strong>"Services"</strong>).
        </p>
        <p>
          This policy should be read together with our{' '}
          <strong>Privacy Policy</strong> and <strong>Terms of Service</strong>.
        </p>
        <p>
          By continuing to use our Services, you may encounter cookies and similar technologies as described below. Where applicable law requires
          consent for non-essential cookies, we will ask for your consent before placing or using those cookies.
        </p>

        <hr />

        <h2>1. What Are Cookies?</h2>
        <p>
          Cookies are small text files placed on your computer, mobile device,
          tablet, or other internet-connected device when you visit a website.
        </p>
        <p>Cookies may allow us to:</p>
        <ul>
          <li>Keep you signed in to your account;</li>
          <li>Maintain secure sessions;</li>
          <li>Remember your preferences;</li>
          <li>Keep our SaaS platform functioning correctly;</li>
          <li>Understand how users interact with our Services;</li>
          <li>Measure website and product performance;</li>
          <li>Detect fraud, abuse, and security threats;</li>
          <li>Process or support payments;</li>
          <li>Provide relevant marketing and advertising;</li>
          <li>Improve our Services and user experience.</li>
        </ul>
        <p>
          We may also use technologies similar to cookies, including pixels, web
          beacons, local storage, session storage, SDKs, tags, and similar
          technologies.
        </p>

        <hr />

        <h2>2. Types of Cookies We Use</h2>
        <p>We generally use the following categories of cookies.</p>

        <h3>2.1 Strictly Necessary / Essential Cookies</h3>
        <p>
          These cookies are necessary for the operation, security, and basic
          functionality of our Services.
        </p>
        <p>They may be used for:</p>
        <ul>
          <li>User login and authentication;</li>
          <li>Maintaining user sessions;</li>
          <li>Account security;</li>
          <li>Preventing fraudulent activity;</li>
          <li>Maintaining shopping or subscription sessions;</li>
          <li>Remembering security settings;</li>
          <li>Maintaining user preferences necessary for the Service;</li>
          <li>Load balancing and technical operations;</li>
          <li>Protecting forms and requests against unauthorized activity;</li>
          <li>Maintaining the operation of our SaaS dashboard.</li>
        </ul>
        <p>
          Because these cookies may be technically necessary to provide a
          Service you have requested, they may not require consent in certain
          jurisdictions. We will nevertheless provide appropriate information
          about their use.
        </p>
        <p>
          If you disable these cookies, certain features of our Services may not
          work properly.
        </p>

        <h3>2.2 Analytics and Performance Cookies</h3>
        <p>
          We may use analytics technologies, including services such as{' '}
          <strong>Google Analytics</strong> or similar services, to understand
          how users interact with our website and SaaS platform.
        </p>
        <p>These technologies may collect information such as:</p>
        <ul>
          <li>Pages visited;</li>
          <li>Features used;</li>
          <li>Approximate location;</li>
          <li>Browser and device information;</li>
          <li>Operating system;</li>
          <li>Referring website;</li>
          <li>Session information;</li>
          <li>Interaction and usage information;</li>
          <li>Performance and error information.</li>
        </ul>
        <p>We use this information to:</p>
        <ul>
          <li>Understand website traffic;</li>
          <li>Measure product usage;</li>
          <li>Identify technical problems;</li>
          <li>Improve website performance;</li>
          <li>Improve SaaS features;</li>
          <li>Understand user journeys;</li>
          <li>Develop better products and services.</li>
        </ul>
        <p>
          Where required by applicable law, analytics cookies will only be
          activated after you provide the required consent.
        </p>

        <h3>2.3 Payment-Related Cookies</h3>
        <p>
          Our Services may integrate with third-party payment providers to
          process payments, subscriptions, invoices, renewals, refunds, or other
          transactions.
        </p>
        <p>
          Depending on the payment provider and integration used,
          payment-related technologies may be used for:
        </p>
        <ul>
          <li>Processing payments;</li>
          <li>Maintaining payment sessions;</li>
          <li>Preventing fraud;</li>
          <li>Authenticating transactions;</li>
          <li>Securing payment forms;</li>
          <li>Maintaining subscription status;</li>
          <li>Detecting suspicious transactions.</li>
        </ul>
        <p>
          Payment providers may place or access their own cookies or similar
          technologies.
        </p>

        <h3>2.4 Marketing and Advertising Cookies</h3>
        <p>
          We may use marketing and advertising technologies to understand the
          effectiveness of our advertising campaigns and, where permitted by
          applicable law, provide or measure relevant advertising.
        </p>
        <p>
          Marketing and advertising cookies are generally{' '}
          <strong>non-essential cookies</strong>.
        </p>
        <p>
          Where required by law, we will request your consent before activating
          these technologies.
        </p>

        <h3>2.5 Third-Party Cookies</h3>
        <p>
          Some features of our Services may be provided by third-party service
          providers. These providers may use cookies or similar technologies on
          our Services.
        </p>

        <hr />

        <h2>3. SaaS Account and Login Cookies</h2>
        <p>
          When you create an account or log in to our SaaS platform, we may use
          cookies and similar technologies to:
        </p>
        <ul>
          <li>Authenticate your account;</li>
          <li>Keep you logged in;</li>
          <li>Maintain your session;</li>
          <li>Remember your selected settings;</li>
          <li>Protect your account;</li>
          <li>Identify your authorized session;</li>
          <li>Prevent unauthorized access;</li>
          <li>Maintain the security of our platform.</li>
        </ul>

        <hr />

        <h2>4. Cookie Consent</h2>
        <p>
          Where applicable law requires consent for non-essential cookies, we
          will provide you with a cookie consent mechanism.
        </p>

        <hr />

        <h2>5. How to Change Your Cookie Preferences</h2>
        <p>
          You may change your cookie preferences at any time by selecting:{' '}
          <strong>Cookie Settings / Manage Cookies</strong> on our website.
        </p>

        <hr />

        <h2>6. Browser Cookie Controls</h2>
        <p>
          Most browsers allow you to view, delete, and block cookies. You can
          review your browser's privacy and security settings to manage cookies.
        </p>

        <hr />

        <h2>7. Cookie Retention</h2>
        <p>
          The retention period depends on the purpose of the cookie and the
          service provider.
        </p>

        <hr />

        <h2>8. Information Collected Through Cookies</h2>
        <p>
          For more information about how we process personal data, please review
          our <strong>Privacy Policy</strong>.
        </p>

        <div className='static-page__actions'>
          <Link to='/' className='static-page__button'>
            <FiArrowLeft /> Back to Home
          </Link>
        </div>
      </section>
    </div>
  </main>
);

export default CookiePolicyPage;
