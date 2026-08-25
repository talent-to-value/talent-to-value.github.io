import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '把才华变成价值 · 30 天现实测试',
  description: '把能力、经历和判断整理成别人看得懂、信得过、愿意购买的第一版。',
  icons: {
    icon: '/favicon.png',
  },
  openGraph: {
    title: '把才华变成价值 · 30 天现实测试',
    description: '30 天行动工作台：填写、自动保存、现实验证，并把答案组装成四件可以使用的成果。',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: '把才华变成价值 · 30 天现实测试',
    description: '30 天行动工作台：填写、自动保存、现实验证，并把答案组装成四件可以使用的成果。',
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
