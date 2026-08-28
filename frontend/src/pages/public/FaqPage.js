import Seo from '../../components/site/Seo';
import PublicLayout from '../../components/site/PublicLayout';
import {
  Breadcrumbs,
  FaqAccordion,
  PageHero,
  SectionHeading,
} from '../../components/site/ContentBlocks';

const faqImage =
  'https://res.cloudinary.com/dcmtnkas/image/upload/f_auto,q_auto,w_800/v1787200598/FAQ.png';

const items = [
  { question: 'What is PrivateVoting?', answer: 'PrivateVoting is a secure, cloud-based digital voting platform for school organizations, principals, teachers, housing societies, clubs, non-profits, and enterprises.' },
  { question: 'How can schools and principals use PrivateVoting for student council elections?', answer: 'School principals and coordinators can set up ballots for Head Boy, Head Girl, House Captains, and Class Representatives. Students vote securely using roll numbers or unique voter IDs from classroom tablets, computers, or smartphones.' },
  { question: 'How do housing society chairmen and RWAs conduct AGM elections?', answer: 'Society chairmen and secretaries can upload voter lists with flat/unit numbers and member IDs. Members vote securely from anywhere with instant automated counting and audit-ready reports for AGM records.' },
  { question: 'Can organization admins assign sub-users and polling officers?', answer: 'Yes. Organization administrators can create sub-users with specific permissions (such as view-only, candidate management, or polling supervisor) without sharing master admin credentials.' },
  { question: 'Can I run completely anonymous votes?', answer: 'Yes. The system is designed to keep individual ballots strictly confidential while preserving verifiable, accurate totals and audit trails.' },
  { question: 'Does it support real-time counting and automated results?', answer: 'Yes. Administrators can monitor voter turnout live and instantly generate results with winner summaries as soon as the voting window ends.' },
  { question: 'How are voters verified to prevent duplicate voting?', answer: 'Voter lists are pre-registered with unique identifiers (ID, roll number, flat number, or email). Each voter can cast only one verified vote per post.' },
  { question: 'Do you provide downloadable reports for audits and AGM minutes?', answer: 'Yes. Detailed results, turnout stats, and audit logs can be exported in both PDF and Excel formats.' },
  { question: 'Is the voting platform mobile-friendly?', answer: 'Yes. Voters can cast their ballots seamlessly on smartphones, tablets, laptops, and desktop browsers without installing any external app.' },
  { question: 'Is technical support and demo assistance available?', answer: 'Yes. Our team provides onboarding support and product walkthroughs. Contact us via our contact page.' },
];

const FaqPage = () => (
  <PublicLayout>
    <Seo
      title='FAQ | Online Voting Questions for Schools, Societies & Organizations'
      description='Frequently asked questions about online elections for school principals, teachers, housing society chairmen, and organization admins. Learn about security, voter verification, and results.'
      keywords='school election FAQ, housing society voting questions, student council online voting help, RWA election platform FAQ, organization admin voting guide'
      canonicalPath='/faq'
      schema={[
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: items.map((item) => ({
            '@type': 'Question',
            name: item.question,
            acceptedAnswer: { '@type': 'Answer', text: item.answer },
          })),
        },
      ]}
    />

    <div className='site-container'>
      <Breadcrumbs items={[{ label: 'Home', to: '/' }, { label: 'FAQ' }]} />
    </div>
    <PageHero
      title='Answers to common platform questions'
      description='A quick overview of how the product handles security, verification, reporting and day-to-day use.'
      image={faqImage}
      imageAlt='PrivateVoting FAQ illustration'
    />

    <section className='site-section'>
      <div className='site-container'>
        <SectionHeading
          kicker='FAQ'
          title='Ten questions, answered plainly'
          description='The answers below cover the most common questions from new organizations.'
        />
        <FaqAccordion items={items} />
      </div>
    </section>
  </PublicLayout>
);

export default FaqPage;
