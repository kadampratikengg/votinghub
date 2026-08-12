import {
  FiCheckCircle,
  FiDatabase,
  FiFileText,
  FiGrid,
  FiKey,
  FiRefreshCw,
  FiUsers,
} from 'react-icons/fi';
import Seo from '../../components/site/Seo';
import PublicLayout from '../../components/site/PublicLayout';
import {
  Breadcrumbs,
  CardGrid,
  PageHero,
  SectionHeading,
} from '../../components/site/ContentBlocks';

const FeaturesPage = () => (
  <PublicLayout>
    <Seo
      title='Features | PrivateVoting'
      description='Explore the features of PrivateVoting including anonymous ballots, election scheduling, audit logs, dashboards and reporting.'
      canonicalPath='/features'
      schema={[
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Features | PrivateVoting',
          url: 'https://www.privatevoting.in/features',
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.privatevoting.in/' },
            { '@type': 'ListItem', position: 2, name: 'Features', item: 'https://www.privatevoting.in/features' },
          ],
        },
      ]}
    />

    <div className='site-container'>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Features' }]} />
    </div>
    <PageHero
      title='Everything you need to run a secure election'
      description='From access control to reporting, the platform covers the core workflows required by modern voting teams.'
      image='/images/features.png'
      imageAlt='PrivateVoting feature showcase placeholder'
    />

    <section className='site-section'>
      <div className='site-container'>
        <SectionHeading
          kicker='Capabilities'
          title='Feature set that covers the full workflow'
          description='These are the product capabilities organizations typically need to manage elections with confidence.'
        />
        <CardGrid
          items={[
            { title: 'Candidate Management', description: 'Add, organize, and update candidate profiles.', icon: <FiGrid /> },
            { title: 'Voter Management', description: 'Maintain voter records and participation status.', icon: <FiUsers /> },
            { title: 'Election Scheduling', description: 'Define voting windows and result publishing times.', icon: <FiRefreshCw /> },
            { title: 'Automatic Result Generation', description: 'Count votes and generate totals with minimal manual effort.', icon: <FiCheckCircle /> },
            { title: 'Audit Logs', description: 'Keep an operational record of key actions and changes.', icon: <FiFileText /> },
            { title: 'Role Based Access', description: 'Limit what each user can view and manage.', icon: <FiKey /> },
            { title: 'Excel Reports', description: 'Export result and participant data for offline analysis.', icon: <FiDatabase /> },
            { title: 'PDF Reports', description: 'Generate a formatted summary for stakeholders.', icon: <FiFileText /> },
            { title: 'Mobile Friendly', description: 'Responsive layouts work well on phones and tablets.', icon: <FiCheckCircle /> },
          ]}
        />
      </div>
    </section>
  </PublicLayout>
);

export default FeaturesPage;
