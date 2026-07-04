const SITE = 'https://docs.nombaone.xyz';
const ORG = 'https://nombaone.xyz/#organization';

/** Organization + WebSite structured data for the docs site. */
export function JsonLd() {
  const graph = [
    {
      '@type': 'Organization',
      '@id': ORG,
      name: 'Nomba One',
      url: 'https://nombaone.xyz',
      logo: `${SITE}/apple-icon.png`,
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE}/#website`,
      name: 'Nomba One Docs',
      url: SITE,
      publisher: { '@id': ORG },
      inLanguage: 'en',
    },
  ];
  const json = { '@context': 'https://schema.org', '@graph': graph };
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />
  );
}
