import { Helmet } from 'react-helmet-async';

const ensureAbsoluteUrl = (pathname = '/') => {
  if (typeof window === 'undefined') {
    return `https://www.privatevoting.in${pathname}`;
  }

  const origin = window.location.origin || 'https://www.privatevoting.in';
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${origin}${cleanPath}`;
};

const DEFAULT_KEYWORDS =
  'Private Voting, Online Voting, Voting, School Voting, Free Voting, College Voting, Collage Voting, Live Voting, Private, Free Online Voting, Live Online Voting, Digital Voting, School Online Voting, College Online Voting, Student Council Voting, Housing Society Voting, Society Chairman Voting, Organization Voting, Secure Online Voting Platform';

const Seo = ({
  title,
  description,
  keywords = DEFAULT_KEYWORDS,
  canonicalPath = '/',
  type = 'website',
  image = '/images/hero.png',
  noIndex = false,
  schema = [],
}) => {
  const canonicalUrl = ensureAbsoluteUrl(canonicalPath);
  const fullImageUrl = ensureAbsoluteUrl(image);
  const robots = noIndex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large';

  return (
    <Helmet htmlAttributes={{ lang: 'en' }}>
      <title>{title}</title>
      <meta name='description' content={description} />
      {keywords && <meta name='keywords' content={keywords} />}
      <link rel='canonical' href={canonicalUrl} />
      <link rel='alternate' hrefLang='x-default' href={canonicalUrl} />
      <link rel='alternate' hrefLang='en' href={canonicalUrl} />
      <meta name='robots' content={robots} />
      <meta property='og:site_name' content='PrivateVoting' />
      <meta property='og:locale' content='en_US' />
      <meta property='og:type' content={type} />
      <meta property='og:title' content={title} />
      <meta property='og:description' content={description} />
      <meta property='og:url' content={canonicalUrl} />
      <meta property='og:image' content={fullImageUrl} />
      <meta name='twitter:card' content='summary_large_image' />
      <meta name='twitter:title' content={title} />
      <meta name='twitter:description' content={description} />
      <meta name='twitter:image' content={fullImageUrl} />
      {schema.map((entry, index) => (
        <script
          key={entry['@id'] || entry['@type'] || `schema-${index}`}
          type='application/ld+json'
        >
          {JSON.stringify(entry)}
        </script>
      ))}
    </Helmet>
  );
};

export default Seo;
