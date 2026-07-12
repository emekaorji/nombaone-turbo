import { makeLocalePage } from '@/lib/l10n/locale-page';

const { Page, generateStaticParams, generateMetadata } = makeLocalePage('yo');

export { generateStaticParams, generateMetadata };
export default Page;
