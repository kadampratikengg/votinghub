import { FiAward, FiGlobe, FiShield, FiUsers } from 'react-icons/fi';
import Seo from '../../components/site/Seo';
import PublicLayout from '../../components/site/PublicLayout';
import {
  Breadcrumbs,
  CardGrid,
  PageHero,
  SectionHeading,
  StatsGrid,
  Timeline,
} from '../../components/site/ContentBlocks';

const AboutUsPage = () => (
  <PublicLayout>
    <Seo
      title='About Us | PrivateVoting'
      description='Learn how PrivateVoting helps organizations run secure, transparent, and scalable online elections.'
      canonicalPath='/about-us'
      schema={[
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'About Us | PrivateVoting',
          url: 'https://www.privatevoting.in/about-us',
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: 'https://www.privatevoting.in/',
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'About Us',
              item: 'https://www.privatevoting.in/about-us',
            },
          ],
        },
      ]}
    />

    <div className='site-container'>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'About Us' }]} />
    </div>

    <PageHero
      title='A secure voting platform designed for trust'
      description='PrivateVoting was built to help organizations run elections without sacrificing security, clarity, or the confidence of participants.'
      image='https://res.cloudinary.com/dcmtnkas/image/upload/v1787200598/Features.png'
      imageAlt='PrivateVoting team and mission placeholder'
    />

    <section className='site-section'>
      <div className='site-container'>
        <SectionHeading
          kicker='Our Mission'
          title='Make private elections easier to run'
          description='The product focuses on confidentiality, accurate results, role-based control, and a polished user experience for organizers and voters.'
        />
        <div className='site-lede'>
          <strong>Mission</strong>
          <p>
            Give organizations a dependable way to conduct online voting with
            clear access rules and a simple workflow that reduces operational
            overhead.
          </p>
        </div>
      </div>
    </section>

    <section className='site-section'>
      <div className='site-container'>
        <SectionHeading
          kicker='Values'
          title='What guides the product'
          description='The platform is designed around secure execution, operational transparency, and fast adoption.'
        />
        <CardGrid
          items={[
            {
              title: 'Trust first',
              description:
                'Every workflow aims to preserve confidence in the election outcome.',
              icon: <FiShield />,
            },
            {
              title: 'Built for scale',
              description:
                'The same system can support one committee vote or many recurring elections.',
              icon: <FiGlobe />,
            },
            {
              title: 'People-friendly',
              description:
                'Interfaces remain simple so voters and administrators can act quickly.',
              icon: <FiUsers />,
            },
            {
              title: 'Outcome focused',
              description:
                'The product is built to get a result, not just move data through screens.',
              icon: <FiAward />,
            },
          ]}
        />
      </div>
    </section>

    <section className='site-section'>
      <div className='site-container'>
        <SectionHeading
          kicker='Workflow'
          title='Built in stages with real operational needs'
          description='The roadmap reflects what election managers need in practice: access control, result integrity, reporting, and a clear rollout path.'
        />
        <Timeline
          steps={[
            {
              step: '1',
              title: 'Secure core',
              description:
                'Authentication, role permissions, and protected voting flows.',
            },
            {
              step: '2',
              title: 'Organizer tools',
              description:
                'Dashboard features for candidate, voter, and election management.',
            },
            {
              step: '3',
              title: 'Result workflow',
              description:
                'Live tracking, publication, and exportable reports.',
            },
            {
              step: '4',
              title: 'Scale and support',
              description:
                'Deployment patterns and support processes for larger organizations.',
            },
          ]}
        />
      </div>
    </section>

    <section className='site-section'>
      <div className='site-container'>
        <StatsGrid
          stats={[
            {
              value: '99.99%',
              label: 'Availability target for high-stakes election windows.',
            },
            {
              value: 'India-first',
              label:
                'Designed for societies, colleges, businesses, and public-facing workflows.',
            },
            {
              value: 'Secure by design',
              label:
                'Security and privacy are treated as product requirements, not add-ons.',
            },
          ]}
        />
      </div>
    </section>
  </PublicLayout>
);

export default AboutUsPage;
