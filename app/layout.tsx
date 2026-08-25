import type { Metadata } from 'next';
import './globals.css';

const siteUrl = 'https://talent-to-value-30-days.flowing202008.chatgpt.site';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: '把才华变成价值 · 30 天现实测试',
  description: '帮助有经验、有作品的人，用 30 天做出一套潜在客户看得懂、信得过、买得到的服务说明。',
  icons: {
    icon: '/favicon.png',
  },
  openGraph: {
    title: '把才华变成价值 · 30 天现实测试',
    description: '每天只完成一个决定，并把前一步答案带到后一步，最终组装成可直接测试的服务说明。',
    type: 'website',
    url: siteUrl,
    images: [
      {
        url: `${siteUrl}/og.png`,
        width: 1731,
        height: 909,
        alt: '把才华变成价值 · 30 天现实测试工作台',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '把才华变成价值 · 30 天现实测试',
    description: '每天只完成一个决定，并把前一步答案带到后一步，最终组装成可直接测试的服务说明。',
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
