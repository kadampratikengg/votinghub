import Seo from '../../components/site/Seo';
import PublicLayout from '../../components/site/PublicLayout';
import {
  Breadcrumbs,
  FaqAccordion,
  PageHero,
  SectionHeading,
} from '../../components/site/ContentBlocks';

const items = [
  { question: 'What is PrivateVoting?', answer: 'A secure online voting platform for organizations, societies, schools, colleges, NGOs and enterprises.' },
  { question: 'Can I run anonymous votes?', answer: 'Yes. The system is designed to keep ballots private while preserving secure totals and reports.' },
  { question: 'Does it support real-time counting?', answer: 'Yes. You can monitor results and publish them when your election closes.' },
  { question: 'Can voters be verified by OTP?', answer: 'Yes. OTP, email, and other configured verification methods are supported.' },
  { question: 'Is it mobile friendly?', answer: 'Yes. The public site and voting flows are responsive for small and large screens.' },
  { question: 'Do you offer audit logs?', answer: 'Yes. Auditability is part of the workflow so administrators can review key actions.' },
  { question: 'Can I export reports?', answer: 'Yes. PDF and Excel export paths are included in the product experience.' },
  { question: 'Does the platform support multiple roles?', answer: 'Yes. Role based access helps separate responsibilities across admins and operators.' },
  { question: 'Can I manage elections from one dashboard?', answer: 'Yes. The dashboard is built for centralized election operations.' },
  { question: 'Is support available?', answer: 'Yes. Use the contact page to reach the team.' },
];

const FaqPage = () => (
  <PublicLayout>
    <Seo
      title='FAQ | PrivateVoting'
      description='Find answers to common questions about secure online voting, anonymity, reporting and support.'
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
      image='/images/hero.png'
      imageAlt='PrivateVoting FAQ placeholder'
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
