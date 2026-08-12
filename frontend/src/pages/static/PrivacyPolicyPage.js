import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import Seo from '../../components/site/Seo';
import './MaintenancePage.css';

const PrivacyPolicyPage = () => (
  <main className='static-page'>
    <Seo
      title='Privacy Policy | PrivateVoting'
      description='Read how PrivateVoting handles personal data, voting records, account access, and ballot privacy.'
      canonicalPath='/privacy-policy'
    />
    <div className='static-page__shell'>
      <section className='static-page__panel'>
        <h1>Privacy Policy - Private Voting Platform</h1>
        <p>
          <strong>Effective Date:</strong> 26 November 2023
        </p>
        <p>
          <strong>Last Updated:</strong> 26 November 2023
        </p>

        <h2>1. Introduction</h2>
        <p>
          Welcome to the Private Voting Platform. This Privacy Policy explains
          how personal information is collected, used, stored, and protected
          while conducting elections through the Platform.
        </p>
        <p>
          The Platform is designed to provide a secure, transparent, and
          confidential voting experience. It ensures that only eligible voters
          can cast votes, each voter votes only as permitted, and election
          integrity is maintained.
        </p>

        <hr />

        <h2>2. Information We Collect</h2>
        <p>To conduct secure elections, we may collect:</p>
        <ul>
          <li>Voter name</li>
          <li>Voter ID, Employee ID, Student ID, or Member ID</li>
          <li>Mobile number or email address (if required for verification)</li>
          <li>Organization-issued identification (where applicable)</li>
          <li>Voting eligibility information</li>
          <li>Device and browser information</li>
          <li>IP address (if IP restriction is enabled)</li>
          <li>Date and time of verification and voting</li>
          <li>System activity and audit logs</li>
        </ul>
        <p>
          Only information necessary for conducting and securing the election is
          collected.
        </p>

        <hr />

        <h2>3. How We Use Your Information</h2>
        <p>
          Your information is used only for purposes related to the election,
          including:
        </p>
        <ul>
          <li>Verifying voter identity and eligibility</li>
          <li>Conducting the voting process</li>
          <li>Preventing duplicate voting</li>
          <li>Maintaining election audit records</li>
          <li>Detecting unauthorized or fraudulent activity</li>
          <li>Generating election reports and results</li>
        </ul>
        <p>
          We do not sell or use personal information for advertising or
          marketing.
        </p>

        <hr />

        <h2>4. Voter Verification</h2>
        <p>
          Before a ballot is issued, every voter must complete the verification
          process established by the organization.
        </p>
        <p>Verification may include:</p>
        <ul>
          <li>Voter ID verification</li>
          <li>Employee or Member ID verification</li>
          <li>QR Code verification / Upcomming</li>
          <li>OTP verification / Upcomming</li>
          <li>Organization-issued credentials / Upcomming</li>
          <li>Other approved verification methods</li>
        </ul>
        <p>Only verified and eligible voters are allowed to cast votes.</p>

        <hr />

        <h2>5. Voting Process</h2>
        <p>The voting process is similar to a traditional polling booth:</p>
        <ol>
          <li>The voter arrives at the voting station.</li>
          <li>An authorized User verifies the voter's identity.</li>
          <li>The system confirms voter eligibility.</li>
          <li>The voter is issued the ballot.</li>
          <li>The voter casts the permitted vote(s).</li>
          <li>The vote is securely recorded.</li>
          <li>
            The system immediately marks the voter as having completed voting and
            prevents any additional votes beyond the permitted limit.
          </li>
        </ol>

        <hr />

        <h2>6. Single and Multiple Vote Elections</h2>
        <p>Depending on the election configuration:</p>
        <h3>Single Vote</h3>
        <ul>
          <li>One voter may cast one vote only.</li>
          <li>Once submitted, additional voting is not allowed.</li>
        </ul>
        <h3>Multiple Vote</h3>
        <ul>
          <li>
            A voter may cast multiple votes only up to the limit defined for
            that election.
          </li>
          <li>
            The system automatically blocks any votes beyond the permitted limit.
          </li>
        </ul>

        <hr />

        <h2>7. Prevention of Duplicate Voting</h2>
        <p>The Platform protects election integrity through:</p>
        <ul>
          <li>Identity verification</li>
          <li>Eligibility validation</li>
          <li>Vote completion tracking</li>
          <li>Secure voting sessions</li>
          <li>Audit logs</li>
          <li>Optional IP restriction</li>
          <li>Database integrity controls</li>
        </ul>
        <p>
          After the permitted vote(s) have been cast, the voter cannot vote
          again in the same election.
        </p>

        <hr />

        <h2>8. Ballot Privacy</h2>
        <p>The confidentiality of every ballot is protected.</p>
        <p>The Platform ensures that:</p>
        <ul>
          <li>Individual vote selections remain confidential.</li>
          <li>Unauthorized persons cannot view vote choices.</li>
          <li>
            Only authorized election management personnel can access election
            administration functions.
          </li>
          <li>Published results never reveal how an individual voted.</li>
        </ul>

        <hr />

        <h2>9. Election Results</h2>
        <p>Election results may be published:</p>
        <ul>
          <li>Immediately after voting ends, or</li>
          <li>At a time determined by the organization.</li>
        </ul>
        <p>
          Only authorized personnel can access election management functions.
          Published results display only aggregated vote totals.
        </p>

        <hr />

        <h2>10. Roles and Access Permissions</h2>
        <p>The Platform uses Role-Based Access Control (RBAC).</p>

        <h3>A. Super Administrator</h3>
        <p>
          The Super Administrator is the owner or authorized representative of
          the organization. The Super Administrator can access all features.
        </p>

        <h3>B. Administrator</h3>
        <p>
          Administrators are assigned by the Super Administrator to manage
          elections. They have restricted access and cannot manage billing or
          system-wide settings.
        </p>

        <h3>C. User (Polling Officer / Election Officer)</h3>
        <p>
          A <strong>User</strong> is an authorized person responsible for
          conducting the voting process. Users do not manage elections or
          organization settings.
        </p>

        <h3>D. Voter</h3>
        <p>
          A <strong>Voter</strong> is a person who participates in an election.
          Voters are not system users and do not have administrative access,
          user accounts, dashboards, or management permissions.
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

export default PrivacyPolicyPage;

