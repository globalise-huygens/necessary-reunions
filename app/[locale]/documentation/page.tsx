import { DocumentationContent } from '../../../components/DocumentationContent';

export default async function Documentation({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return <DocumentationContent locale={locale} />;
}
