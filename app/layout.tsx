import type { Metadata } from 'next';
import './globals.css';

const siteUrl = 'https://talent-to-value-30-days.flowing202008.chatgpt.site';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: '教你如何把才华变成钱',
  description: '用 28 关想清楚：你能帮谁、别人为什么信你，以及怎样把能力变成可以购买的服务或产品。',
  icons: {
    icon: '/favicon.png',
  },
  openGraph: {
    title: '教你如何把才华变成钱',
    description: '28 关，一步一步把能力变成可以购买的服务或产品。',
    type: 'website',
    url: siteUrl,
    images: [
      {
        url: `${siteUrl}/og.png`,
        width: 1730,
        height: 909,
        alt: '教你如何把才华变成钱',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '教你如何把才华变成钱',
    description: '28 关，一步一步把能力变成可以购买的服务或产品。',
    images: [`${siteUrl}/og.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
