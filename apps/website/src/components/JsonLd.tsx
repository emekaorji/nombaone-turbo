const SITE = "https://nombaone.xyz";

/** Organization + WebSite structured data (schema.org) for the whole site. */
export function JsonLd() {
  const graph = [
    {
      "@type": "Organization",
      "@id": `${SITE}/#organization`,
      name: "Nomba One",
      url: SITE,
      logo: `${SITE}/apple-icon.png`,
      description:
        "Managed recurring billing for Nigeria — subscriptions, dunning, reconciliation, and settlement across every rail, built on the Nomba infrastructure.",
      areaServed: "NG",
    },
    {
      "@type": "WebSite",
      "@id": `${SITE}/#website`,
      name: "Nomba One",
      url: SITE,
      publisher: { "@id": `${SITE}/#organization` },
      inLanguage: "en-NG",
    },
  ];
  const json = { "@context": "https://schema.org", "@graph": graph };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
