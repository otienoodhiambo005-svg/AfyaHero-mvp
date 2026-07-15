import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: 'AfyaHero Pulse — %s',
    default: 'AfyaHero Pulse — Authentication',
  },
  description: 'Sign in, register, or recover access to AfyaHero Pulse. Do not enter patient information on these screens.',
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}

