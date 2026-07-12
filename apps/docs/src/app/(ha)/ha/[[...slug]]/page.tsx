import { makeLocalePage } from '@/lib/l10n/locale-page';

const { Page, generateStaticParams, generateMetadata } = makeLocalePage('ha');

export { generateStaticParams, generateMetadata };
export default Page;
