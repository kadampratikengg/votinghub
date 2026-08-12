import { Helmet } from 'react-helmet-async';

const ensureAbsoluteUrl = (pathname = '/') => {
  if (typeof window === 'undefined') {
    return `https://www.privatevoting.in${pathname}`;
  }

  const origin = window.location.origin || 'https://www.privatevoting.in';
  const cleanPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${origin}${cleanPath}`;
};

const Seo = ({
  title,
  description,
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
    <Helmet>
      <title>{title}</title>
      <meta name='description' content={description} />
      <link rel='canonical' href={canonicalUrl} />
      <meta name='robots' content={robots} />
      <meta property='og:type' content={type} />
      <meta property='og:title' content={title} />
      <meta property='og:description' content={description} />
      <meta property='og:url' content={canonicalUrl} />
      <meta property='og:image' content={fullImageUrl} />
      <meta name='twitter:card' content='summary_large_image' />
      <meta name='twitter:title' content={title} />
      <meta name='twitter:description' content={description} />
      <meta name='twitter:image' content={fullImageUrl} />
      {schema.map((entry) => (
        <script
          key={entry['@id'] || entry['@type']}
          type='application/ld+json'
        >
          {JSON.stringify(entry)}
        </script>
      ))}
    </Helmet>
  );
};

export default Seo;
