import { FiDatabase, FiLock, FiShield, FiUserCheck, FiXOctagon } from 'react-icons/fi';
import Seo from '../../components/site/Seo';
import PublicLayout from '../../components/site/PublicLayout';
import {
  Breadcrumbs,
  CardGrid,
  PageHero,
  SectionHeading,
} from '../../components/site/ContentBlocks';

const securityImage =
  'https://res.cloudinary.com/dcmtnkas/image/upload/f_auto,q_auto,w_800/v1787200599/Security.png';

const SecurityPage = () => (
  <PublicLayout>
    <Seo
      title='Security | Secure Online Voting & Data Protection for Institutions'
      description='Learn about PrivateVoting security features: anonymous ballots, encrypted vote records, IP restrictions, voter verification, and tamper-proof audit trails for schools, societies, and organizations.'
      keywords='secure online voting, encrypted election platform, anonymous voting security, voter verification system, election audit trail, data privacy in online elections'
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
