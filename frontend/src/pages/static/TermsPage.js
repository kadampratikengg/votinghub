import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import Seo from '../../components/site/Seo';
import './MaintenancePage.css';

const TermsPage = () => (
  <main className='static-page'>
    <Seo
      title='Terms of Service | PrivateVoting'
      description='Review the terms that govern the use of PrivateVoting, including account responsibilities and permitted use.'
      canonicalPath='/terms-of-service'
    />
    <div className='static-page__shell'>
      <section className='static-page__panel'>
        <h1>Terms of Service - Private Voting Platform</h1>
        <p>
          <strong>Effective Date:</strong> 26 November 2023
        </p>
        <p>
          <strong>Last Updated:</strong> 26 November 2023
        </p>

        <hr />

        <h2>1. Acceptance of Terms</h2>
        <p>
          Welcome to the <strong>Private Voting Platform</strong> ("Platform",
          "we", "our", or "us").
        </p>
        <p>
          By accessing or using the Platform, you agree to comply with these
          Terms of Service ("Terms"). If you do not agree with these Terms, you
          must not use the Platform.
        </p>
        <p>
          These Terms apply to all organizations, administrators, users, and
          voters who interact with the Platform.
        </p>

        <hr />

        <h2>2. About the Platform</h2>
        <p>
          The Private Voting Platform is a cloud-based voting management system
          that enables organizations to conduct secure, transparent, and
          efficient elections.
        </p>
        <p>The Platform supports:</p>
        <ul>
          <li>Organization-managed elections</li>
          <li>Secure voter verification</li>
          <li>Single or multiple vote elections</li>
          <li>Polling officer assisted voting</li>
          <li>Real-time election management</li>
          <li>Secure vote recording</li>
          <li>Role-based administration</li>
          <li>Election result publication</li>
        </ul>
        <p>
          The Platform is intended for lawful organizational, educational,
          corporate, association, cooperative, society, club, and institutional
          voting activities.
        </p>

        <hr />

        <h2>3. Definitions</h2>
        <p>For the purposes of these Terms:</p>

        <h3>Organization</h3>
        <p>The entity that creates and manages elections using the Platform.</p>

        <h3>Super Administrator</h3>
        <p>
          The owner or authorized representative of an organization with full
          administrative privileges.
        </p>

        <h3>Administrator</h3>
        <p>
          A person authorized by the Super Administrator to manage election
          events.
        </p>

        <h3>User</h3>
        <p>
          A Polling Officer or Election Officer authorized to verify voters and
          conduct voting during an election.
        </p>

        <h3>Voter</h3>
        <p>An individual authorized to participate in an election.</p>
        <p>
          A Voter is <strong>not</strong> a registered system user and does not
          receive administrative access, a dashboard, or an account unless the
          organization specifically enables such functionality in the future.
        </p>

        <hr />

        <h2>4. Eligibility</h2>
        <p>
          Organizations using the Platform must ensure they have legal
          authority to conduct elections.
        </p>
        <p>Users of administrative functions must:</p>
        <ul>
          <li>Be authorized by the organization.</li>
          <li>Use accurate information.</li>
          <li>Comply with applicable laws and organizational policies.</li>
        </ul>

        <hr />

        <h2>5. Accounts</h2>
        <p>Administrative accounts are available only for:</p>
        <ul>
          <li>Super Administrators</li>
          <li>Administrators</li>
          <li>Authorized Users (Polling Officers)</li>
        </ul>
        <p>Administrative users are responsible for:</p>
        <ul>
          <li>Maintaining password confidentiality.</li>
          <li>Preventing unauthorized access.</li>
          <li>Immediately reporting suspected security incidents.</li>
          <li>Logging out from shared devices.</li>
        </ul>
        <p>
          Organizations are responsible for managing their own authorized users.
        </p>

        <hr />

        <h2>6. Voter Access</h2>
        <p>Voters do not require administrative accounts.</p>
        <p>A voter's participation is limited to:</p>
        <ul>
          <li>Identity verification</li>
          <li>Receiving an authorized ballot</li>
          <li>Casting the permitted vote(s)</li>
        </ul>
        <p>The Platform does not provide voters with:</p>
        <ul>
          <li>Dashboards</li>
          <li>Administrative access</li>
          <li>Organization management</li>
          <li>Election management</li>
          <li>Billing access</li>
          <li>System settings</li>
        </ul>

        <hr />

        <h2>7. Role-Based Permissions</h2>
        <p>The Platform uses Role-Based Access Control (RBAC).</p>

        <h3>Super Administrator</h3>
        <p>May:</p>
        <ul>
          <li>Manage organization profile</li>
          <li>Manage subscriptions</li>
          <li>View invoices</li>
          <li>Configure settings</li>
          <li>Enable IP restrictions</li>
          <li>Create, edit, delete, and conduct elections</li>
          <li>View results</li>
          <li>Manage administrators</li>
          <li>Access reports</li>
        </ul>

        <h3>Administrator</h3>
        <p>May:</p>
        <ul>
          <li>Access dashboard</li>
          <li>Create elections</li>
          <li>Edit elections before start</li>
          <li>Delete elections before start</li>
          <li>Conduct elections</li>
          <li>View results</li>
        </ul>
        <p>Cannot:</p>
        <ul>
          <li>Manage subscriptions</li>
          <li>Access invoices</li>
          <li>Change organization settings</li>
          <li>Configure system security</li>
        </ul>

        <h3>User (Polling Officer)</h3>
        <p>May:</p>
        <ul>
          <li>Verify voters</li>
          <li>Search voters</li>
          <li>Issue ballots</li>
          <li>Conduct voting</li>
          <li>Access dashboard</li>
          <li>View verification status</li>
        </ul>
        <p>Cannot:</p>
        <ul>
          <li>Create elections</li>
          <li>Delete elections</li>
          <li>Edit elections</li>
          <li>View election results</li>
          <li>Modify organization settings</li>
        </ul>

        <h3>Voter</h3>
        <p>May only:</p>
        <ul>
          <li>Verify identity</li>
          <li>Cast permitted vote(s)</li>
        </ul>
        <p>Cannot:</p>
        <ul>
          <li>Access the administration system</li>
          <li>Access dashboards</li>
          <li>Manage elections</li>
          <li>View restricted information</li>
          <li>Conduct elections</li>
        </ul>

        <hr />

        <h2>8. Voting Rules</h2>
        <p>Organizations are responsible for configuring election rules.</p>
        <p>The Platform supports:</p>
        <ul>
          <li>Single-vote elections</li>
          <li>Multiple-vote elections</li>
        </ul>
        <p>Voting eligibility is determined by the organization.</p>
        <p>Only verified voters may participate.</p>

        <hr />

        <h2>9. Duplicate Voting</h2>
        <p>
          The Platform includes mechanisms to prevent duplicate voting. These
          may include:
        </p>
        <ul>
          <li>Identity verification</li>
          <li>Vote status tracking</li>
          <li>Audit logging</li>
          <li>Secure session validation</li>
          <li>Optional IP restriction</li>
          <li>Eligibility validation</li>
        </ul>
        <p>
          Once a voter completes the permitted vote(s), additional voting
          attempts are blocked.
        </p>

        <hr />

        <h2>10. Election Integrity</h2>
        <p>The Platform is designed to maintain election integrity by:</p>
        <ul>
          <li>Recording votes securely</li>
          <li>Preventing unauthorized modifications</li>
          <li>Maintaining audit logs</li>
          <li>Restricting access through role-based permissions</li>
          <li>Protecting confidential voting information</li>
        </ul>
        <p>
          Organizations remain responsible for configuring and conducting
          elections fairly and according to their own policies and applicable
          laws.
        </p>

        <hr />

        <h2>11. Results</h2>
        <p>
          Election results are available according to the election
          configuration.
        </p>
        <p>Organizations may choose to:</p>
        <ul>
          <li>Publish results immediately after voting ends</li>
          <li>Publish results later</li>
          <li>Restrict access to authorized personnel</li>
        </ul>
        <p>The Platform displays vote totals based on recorded ballots.</p>

        <hr />

        <h2>12. Organization Responsibilities</h2>
        <p>Organizations agree to:</p>
        <ul>
          <li>Maintain accurate voter information.</li>
          <li>Authorize trusted administrators and users.</li>
          <li>Conduct lawful elections.</li>
          <li>Protect administrative credentials.</li>
          <li>Review election settings before publishing.</li>
          <li>Comply with applicable legal and regulatory requirements.</li>
        </ul>
        <p>
          Organizations are responsible for all actions performed using their
          administrative accounts.
        </p>

        <hr />

        <h2>13. Acceptable Use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use the Platform for unlawful purposes.</li>
          <li>Attempt unauthorized access.</li>
          <li>Interfere with election processes.</li>
          <li>Manipulate election results.</li>
          <li>Circumvent voting restrictions.</li>
          <li>Share administrative credentials.</li>
          <li>Introduce malware or malicious code.</li>
          <li>Attempt to reverse engineer or compromise the Platform.</li>
        </ul>
        <p>
          Violation of these Terms may result in suspension or termination of
          access.
        </p>

        <hr />

        <h2>14. Intellectual Property</h2>
        <p>
          The Platform, including its software, interface, design, branding,
          documentation, logos, and related content, is the property of the
          Platform owner or its licensors and is protected by applicable
          intellectual property laws.
        </p>
        <p>Organizations retain ownership of their own election data.</p>

        <hr />

        <h2>15. Privacy</h2>
        <p>Use of the Platform is also governed by the Privacy Policy.</p>
        <p>
          Organizations are responsible for ensuring they have the necessary
          rights and permissions to collect and process voter information.
        </p>

        <hr />

        <h2>16. Data Security</h2>
        <p>
          We implement commercially reasonable technical and organizational
          safeguards, including:
        </p>
        <ul>
          <li>Encrypted communications (HTTPS/TLS)</li>
          <li>Role-based access controls</li>
          <li>Secure authentication</li>
          <li>Audit logging</li>
          <li>Access monitoring</li>
          <li>Regular maintenance and security updates</li>
        </ul>
        <p>
          While we strive to protect data, no online system can guarantee
          absolute security.
        </p>

        <hr />

        <h2>17. Service Availability</h2>
        <p>
          We aim to provide reliable service but do not guarantee uninterrupted
          or error-free operation.
        </p>
        <p>
          Scheduled maintenance, upgrades, technical issues, or circumstances
          beyond our reasonable control may temporarily affect service
          availability.
        </p>

        <hr />

        <h2>18. Subscription and Billing</h2>
        <p>Certain Platform features may require a paid subscription.</p>
        <p>Organizations are responsible for:</p>
        <ul>
          <li>Selecting an appropriate subscription plan.</li>
          <li>Providing accurate billing information.</li>
          <li>Paying applicable subscription fees.</li>
        </ul>
        <p>
          Failure to pay required fees may result in suspension or limitation
          of services.
        </p>

        <hr />

        <h2>19. Suspension and Termination</h2>
        <p>We reserve the right to suspend or terminate access if:</p>
        <ul>
          <li>These Terms are violated.</li>
          <li>Fraudulent or unlawful activity is detected.</li>
          <li>The Platform is used to compromise election integrity.</li>
          <li>Payment obligations are not fulfilled.</li>
          <li>Continued access poses a security risk.</li>
        </ul>
        <p>
          Termination does not relieve organizations of outstanding payment
          obligations.
        </p>

        <hr />

        <h2>20. Disclaimer</h2>
        <p>The Platform provides tools to facilitate secure election management.</p>
        <p>We do not guarantee:</p>
        <ul>
          <li>Election outcomes</li>
          <li>Candidate success</li>
          <li>Voter participation levels</li>
          <li>Compliance with every jurisdiction's election laws</li>
        </ul>
        <p>
          Organizations remain responsible for configuring and conducting
          elections appropriately.
        </p>

        <hr />

        <h2>21. Limitation of Liability</h2>
        <p>
          To the maximum extent permitted by applicable law, the Platform and
          its owners shall not be liable for indirect, incidental, special,
          consequential, or punitive damages arising from the use or inability
          to use the Platform.
        </p>
        <p>
          Our total liability shall not exceed the amount paid by the
          organization for the Platform during the twelve (12) months preceding
          the event giving rise to the claim, where permitted by law.
        </p>

        <hr />

        <h2>22. Changes to These Terms</h2>
        <p>We may update these Terms from time to time.</p>
        <p>
          Updated versions become effective upon publication on the Platform
          unless otherwise stated.
        </p>
        <p>
          Continued use of the Platform after changes constitutes acceptance of
          the revised Terms.
        </p>

        <hr />

        <h2>23. Governing Law</h2>
        <p>
          These Terms shall be governed by and interpreted in accordance with
          the laws of the jurisdiction in which the Platform operator is
          established, unless otherwise required by applicable law.
        </p>

        <hr />

        <h2>24. Contact</h2>
        <p>
          If you have questions regarding these Terms of Service, please contact
          the Platform operator using the contact information provided on the
          website.
        </p>

        <hr />

        <h1>Core Principles</h1>
        <p>The Private Voting Platform is committed to:</p>
        <ul>
          <li>Secure and confidential voting</li>
          <li>Fair election management</li>
          <li>Role-based access control</li>
          <li>Protection of voter information</li>
          <li>Prevention of duplicate voting</li>
          <li>Transparent election administration</li>
          <li>Reliable vote recording</li>
          <li>Responsible data handling</li>
          <li>Continuous platform security</li>
        </ul>

        <div className='static-page__actions'>
          <Link to='/' className='static-page__button'>
            <FiArrowLeft /> Back to Home
          </Link>
        </div>
      </section>
    </div>
  </main>
);

export default TermsPage;

