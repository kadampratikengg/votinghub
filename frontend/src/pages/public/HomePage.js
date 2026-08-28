import {
  FiArrowRight,
  FiBookOpen,
  FiBriefcase,
  FiFileText,
  FiGlobe,
  FiGrid,
  FiHome,
  FiLock,
  FiMonitor,
  FiShield,
  FiUsers,
  FiUserCheck,
} from 'react-icons/fi';
import { Link } from 'react-router-dom';
import Seo from '../../components/site/Seo';
import PublicLayout from '../../components/site/PublicLayout';
import {
  Callout,
  CardGrid,
  LogoCloud,
  SectionHeading,
  StatsGrid,
} from '../../components/site/ContentBlocks';

const heroImage =
  'https://res.cloudinary.com/dcmtnkas/image/upload/f_auto,q_auto:good,w_600/v1787200598/hero.png';

const featureItems = [
  {
    title: 'Organization-managed elections',
    description:
      'Create and manage elections with controlled access, eligibility rules, and a clear workflow from setup to results.',
    icon: <FiShield />,
    chips: ['Secure setup', 'Eligibility', 'Audit ready'],
  },
  {
    title: 'Voter verification and access control',
    description:
      'Verify voters through secure identity checks and based on permissions so only authorized participants can vote.',
    icon: <FiUserCheck />,
    chips: ['Role access', 'Verified voters'],
  },
  {
    title: 'Private and transparent voting',
    description:
      'Protect ballot confidentiality while maintaining count transparency and reliable election records throughout the process.',
    icon: <FiLock />,
    chips: ['Anonymous ballots', 'Transparent counts', 'Secure recording'],
  },
  {
    title: 'Real-time election monitoring',
    description:
      'Track turnout, review progress, and publish results when the configured voting window closes without manual delays.',
    icon: <FiMonitor />,
    chips: ['Live status', 'Real-time tracking', 'Result publication'],
  },
  {
    title: 'Election dashboard and reporting',
    description:
      'Manage candidates, voters, schedules, audit logs, and reports from one operational command center.',
    icon: <FiFileText />,
    chips: ['Reports', 'Schedules', 'Exports'],
  },
  {
    title: 'Role-based administration',
    description:
      'Assign separate responsibilities to super administrators, administrators, and polling officers without exposing restricted tools.',
    icon: <FiUsers />,
    chips: ['RBAC', 'Permissions', 'Multi-role'],
  },
];

const trustLogos = [
  { name: 'Organizations', icon: <FiUsers /> },
  { name: 'Housing Societies', icon: <FiHome /> },
  { name: 'Schools', icon: <FiBookOpen /> },
  { name: 'Colleges', icon: <FiBookOpen /> },
  { name: 'Corporates', icon: <FiBriefcase /> },
  { name: 'NGOs', icon: <FiGlobe /> },
  { name: 'Government Projects', icon: <FiGrid /> },
];

const electionFormats = [
  {
    title: 'Committee Elections',
    icon: <FiUsers />,
    description: 'Decision-making for boards, committees, and internal groups.',
  },
  {
    title: 'Housing Society Votes',
    icon: <FiHome />,
    description: 'Controlled elections for resident committees and welfare bodies.',
  },
  {
    title: 'School Elections',
    icon: <FiBookOpen />,
    description: 'Student councils and school leadership voting with structure.',
  },
  {
    title: 'College Elections',
    icon: <FiBookOpen />,
    description: 'Campus elections for student leaders and academic bodies.',
  },
  {
    title: 'Corporate Polls',
    icon: <FiBriefcase />,
    description: 'Shareholder voting, internal polls, and employee decision-making.',
  },
  {
    title: 'NGO Decisions',
    icon: <FiGlobe />,
    description: 'Board, policy, and program voting for non-profit organizations.',
  },
];

const reasonsToChoose = [
  {
    value: 'Controlled Access',
    label: 'Administrators and polling officers only see the tools they need.',
    icon: <FiShield />,
  },
  {
    value: 'Auditable Flow',
    label: 'Election steps, vote actions, and results remain easy to review.',
    icon: <FiFileText />,
  },
  {
    value: 'Lawful Use',
    label: 'Built for organizational, educational, corporate, and institutional voting.',
    icon: <FiGlobe />,
  },
];

const controlStats = [
  {
    value: '99.99%',
    label: 'Availability-focused hosting for election windows.',
    icon: <FiMonitor />,
  },
  {
    value: '100%',
    label: 'Role-based controls and secure voter access across the workflow.',
    icon: <FiShield />,
  },
  {
    value: 'Unlimited',
    label: 'Election events, voter segments, and reporting requirements supported.',
    icon: <FiGrid />,
  },
];

const HomePage = () => {
  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'PrivateVoting',
      url: 'https://www.privatevoting.in/',
      logo: 'https://www.privatevoting.in/logo192.png',
      sameAs: [
        'https://www.instagram.com/privatevoting?igsh=MWliNmdpajhqZmhndg%3D%3D&igsi=MWliNmdpajhqZmhndg%3D%3D&utm_source=qr',
        'https://www.facebook.com/share/1LThatW4Gk/?mibextid=wwXIfr',
        'https://x.com/PrivateVoting?s=20',
        'https://www.youtube.com/@PrivateVoting',
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'PrivateVoting',
      url: 'https://www.privatevoting.in/',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'PrivateVoting | Secure Online Voting Platform',
      url: 'https://www.privatevoting.in/',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'PrivateVoting',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description:
        'Secure online voting platform for school organizations, principals, coordinators, teachers, housing society chairmen, and organization admins.',
      offers: {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'INR',
      },
      audience: [
        {
          '@type': 'Audience',
          audienceType: 'School Principals, Coordinators, Teachers & Educational Institutions',
        },
        {
          '@type': 'Audience',
          audienceType: 'Housing Society Chairmen, Secretaries & Resident Welfare Associations (RWA)',
        },
        {
          '@type': 'Audience',
          audienceType: 'Organization Administrators, Board Members & Higher Authorities',
        },
      ],
    },
  ];

  return (
    <PublicLayout>
      <Seo
        title='Private Voting | Online Voting, School Voting, Free Voting & Live Voting Platform'
        description='Private Voting & Online Voting platform. Free Voting, School Voting, College Voting, and Live Voting for schools, colleges, societies, and organizations with verified voters and real-time results.'
        keywords='Private Voting, Online Voting, Voting, School Voting, Free Voting, College Voting, Collage Voting, Live Voting, Private, Free Online Voting, Live Online Voting, Digital Voting, School Online Voting, College Online Voting, Student Council Voting, Housing Society Voting, Society Chairman Voting, Organization Voting, Secure Online Voting Platform, Online Voting Software'
        canonicalPath='/'
        schema={schema}
      />

      <section className='site-page-hero'>
        <div className='site-container site-page-hero__grid'>
          <div>
            <span className='site-kicker'>
              <FiShield /> Private Voting & Live Online Voting
            </span>
            <h1>Private Online Voting Platform for Schools, Colleges & Organizations</h1>
            <p>
              Experience secure Private Voting, School Voting, College Voting,
              and Live Voting. Built for School Principals, Coordinators,
              Teachers, Society Chairmen, and Organization Admins with free trial
              credits and real-time results.
            </p>

            <div className='site-page-hero__actions'>
              <Link to='/create-account' className='site-button'>
                Get Started <FiArrowRight />
              </Link>
              <Link to='/contact' className='site-button--ghost'>
                Book Demo
              </Link>
              <Link to='/features' className='site-button--ghost'>
                Watch Demo
              </Link>
            </div>
          </div>

          <div className='site-page-hero__panel'>
            <img
              src={heroImage}
              srcSet='
                https://res.cloudinary.com/dcmtnkas/image/upload/f_auto,q_auto:good,w_320/v1787200598/hero.png 320w,
                https://res.cloudinary.com/dcmtnkas/image/upload/f_auto,q_auto:good,w_480/v1787200598/hero.png 480w,
                https://res.cloudinary.com/dcmtnkas/image/upload/f_auto,q_auto:good,w_600/v1787200598/hero.png 600w,
                https://res.cloudinary.com/dcmtnkas/image/upload/f_auto,q_auto:good,w_900/v1787200598/hero.png 900w,
                https://res.cloudinary.com/dcmtnkas/image/upload/f_auto,q_auto:good,w_1200/v1787200598/hero.png 1200w
              '
              sizes='(max-width: 640px) calc(100vw - 32px), (max-width: 920px) 45vw, 588px'
              alt='PrivateVoting secure digital voting platform preview'
              className='site-placeholder__image'
              width={588}
              height={392}
              loading='eager'
              decoding='async'
            />
          </div>
        </div>
      </section>

      <section className='site-section site-section--tight'>
        <div className='site-container'>
          <SectionHeading
            kicker='Trusted by'
            title='Organizations that use PrivateVoting'
            description='Built for organizations that need a controlled, auditable election workflow.'
          />
          <LogoCloud logos={trustLogos} />
        </div>
      </section>

      <section className='site-section'>
        <div className='site-container'>
          <SectionHeading
            kicker='Features'
            title='A complete voting workflow'
            description='The platform covers creation, verification, voting, monitoring, and closing in one place.'
          />
          <CardGrid items={featureItems} />
        </div>
      </section>

      <section className='site-section'>
        <div className='site-container'>
          <SectionHeading
            kicker='Security'
            title='Built for controlled, auditable voting'
            description='Security is layered across voter verification, role control, secure recording, and audit logging.'
          />
          <StatsGrid stats={controlStats} />
          
        </div>
      </section>

      <section className='site-section'>
        <div className='site-container'>
          <SectionHeading
            kicker='Formats'
            title='Designed for many election formats'
            description='Add the election type that fits your organization and keep the same secure workflow.'
          />
          <CardGrid className='site-grid--cases' items={electionFormats} />
        </div>
      </section>

      <section className='site-section'>
        <div className='site-container'>
          <SectionHeading
            kicker='Why PrivateVoting'
            title='Why organizations choose PrivateVoting'
            description='The ui below reflects the key operational reasons teams adopt the platform.'
          />
          <CardGrid
            items={reasonsToChoose.map((item) => ({
              title: item.value,
              description: item.label,
              icon: item.icon,
              chips: item.value === 'Controlled Access'
                ? ['RBAC', 'Secure access', 'Scoped permissions']
                : item.value === 'Auditable Flow'
                  ? ['Logs', 'Traceability', 'Reports']
                  : ['Organization use', 'Education', 'Corporate governance'],
            }))}
          />
        </div>
      </section>

      <section className='site-section'>
        <div className='site-container'>
          <Callout
            title='Ready to conduct your next election?'
            description='Start an account or connect with the team to plan a secure rollout for your organization.'
            primary={{ label: 'Start Free', to: '/create-account' }}
            secondary={{ label: 'Contact Sales', to: '/contact' }}
          />
        </div>
      </section>
    </PublicLayout>
  );
};

export default HomePage;
