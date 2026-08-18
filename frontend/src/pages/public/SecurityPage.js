import { FiDatabase, FiLock, FiShield, FiUserCheck, FiXOctagon } from 'react-icons/fi';
import Seo from '../../components/site/Seo';
import PublicLayout from '../../components/site/PublicLayout';
import securityImage from '../../images/Security.png';
import {
  Breadcrumbs,
  CardGrid,
  PageHero,
  SectionHeading,
} from '../../components/site/ContentBlocks';

const SecurityPage = () => (
  <PublicLayout>
    <Seo
      title='Security | PrivateVoting'
      description='PrivateVoting uses SSL encryption, JWT security, encrypted data handling and role permissions to protect voting workflows.'
      canonicalPath='/security'
      schema={[
        {
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'Security | PrivateVoting',
          url: 'https://www.privatevoting.in/security',
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.privatevoting.in/' },
            { '@type': 'ListItem', position: 2, name: 'Security', item: 'https://www.privatevoting.in/security' },
          ],
        },
      ]}
    />

    <div className='site-container'>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'Security' }]} />
    </div>
    <PageHero
      title='Security controls for private, auditable voting'
      description='The platform applies layered protection around identity, ballots, transport, storage, and access control.'
      image={securityImage}
      imageAlt='PrivateVoting security illustration'
    />

    <section className='site-section'>
      <div className='site-container'>
        <SectionHeading
          kicker='Safeguards'
          title='Security layers you can explain to stakeholders'
          description='Each layer is designed to reduce risk without making voting overly complex for participants.'
        />
        <CardGrid
          items={[
            { title: 'SSL Encryption', description: 'Traffic between browsers and servers is protected in transit.', icon: <FiShield /> },
            { title: 'JWT Security', description: 'Tokens support authenticated sessions with controlled access.', icon: <FiLock /> },
            { title: 'Secure API', description: 'Protected APIs reduce unauthorized access to election operations.', icon: <FiUserCheck /> },
            { title: 'Encrypted Database', description: 'Sensitive records are stored with encryption-aware handling.', icon: <FiDatabase /> },
            { title: 'Anonymous Ballots', description: 'Ballot confidentiality remains separated from identity checks.', icon: <FiShield /> },
            { title: 'Tamper Resistant Process', description: 'Audits and role restrictions help preserve integrity.', icon: <FiXOctagon /> },
          ]}
        />
      </div>
    </section>
  </PublicLayout>
);

export default SecurityPage;
