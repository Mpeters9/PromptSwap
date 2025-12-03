type MetaArgs = {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
};

const defaultTitle = 'PromptSwap';
const defaultDescription = 'Discover, buy, and sell high-quality prompts.';
const defaultImage = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/og`;
const defaultUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export function buildMetadata({ title, description, image, url }: MetaArgs) {
  const metaTitle = title || defaultTitle;
  const metaDescription = description || defaultDescription;
  const metaImage = image || defaultImage;
  const metaUrl = url || defaultUrl;

  return {
    title: metaTitle,
    description: metaDescription,
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      url: metaUrl,
      images: metaImage ? [{ url: metaImage }] : undefined,
    },
    twitter: {
      card: 'summary_large_image' as const,
      title: metaTitle,
      description: metaDescription,
      images: metaImage ? [metaImage] : undefined,
    },
  };
}
