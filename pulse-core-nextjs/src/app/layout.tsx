import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Cormorant_Garamond, DM_Sans, DM_Mono } from 'next/font/google';
import './globals.css';
import ServiceWorkerRegistration from '@/components/shared/ServiceWorkerRegistration';
import { AIConsentProvider } from '@/lib/ai-consent-context';
import { AIConsentModal } from '@/components/ai-consent-modal';
import { NetworkStatusBanner } from '@/components/network-status-banner';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { logEnvStatus } from '@/lib/env';

const cormorant = Cormorant_Garamond({
    subsets: ['latin'],
    weight: ['300', '400', '600'],
    style: ['normal', 'italic'],
    variable: '--font-serif',
    display: 'swap', // Prevent FOUT (Flash of Unstyled Text)
    preload: true,
});

const dmSans = DM_Sans({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600'],
    variable: '--font-sans',
    display: 'swap',
    preload: true,
});

const dmMono = DM_Mono({
    subsets: ['latin'],
    weight: ['400', '500'],
    variable: '--font-mono',
    display: 'swap',
    preload: true,
});

export const metadata: Metadata = {
    title: "AfyaHero | Africa's Health Infrastructure",
    description: 'Healthcare that reaches everyone, works everywhere, never lets you down.',
    icons: {
        icon: '/afyahero-icon.jpeg',
        apple: '/afyahero-icon.jpeg',
    },
    manifest: '/manifest.json',
    appleWebApp: {
        capable: true,
        statusBarStyle: 'black-translucent',
        title: 'AfyaHero',
    },
};

export const viewport: Viewport = {
    themeColor: '#3282B8',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    logEnvStatus();

    return (
        <html lang="en">
            <head>
                {/* Favicon */}
                <link rel="icon" href="/afyahero-icon.jpeg" />
                <link rel="apple-touch-icon" href="/afyahero-icon.jpeg" />
                
                {/* Resource hints for critical third-party services */}
                <link rel="dns-prefetch" href="https://images.unsplash.com" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link rel="dns-prefetch" href="https://generativelanguage.googleapis.com" />
                <link rel="dns-prefetch" href="https://api.anthropic.com" />
                <link rel="dns-prefetch" href="https://api.openai.com" />
                
                {/* Preload critical resources */}
                <link rel="preload" href="/logo.jpeg" as="image" type="image/jpeg" />
                <link rel="preload" href="/afyahero-icon.jpeg" as="image" type="image/jpeg" />
                <link rel="preload" href="/login-bg.png" as="image" type="image/png" />
                
                {/* PWA manifest and metadata */}
                <link rel="manifest" href="/manifest.json" />
                <meta name="mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
                <meta name="apple-mobile-web-app-title" content="AfyaHero" />
            </head>
            <body className={`${cormorant.variable} ${dmSans.variable} ${dmMono.variable} font-sans bg-content-bg text-charcoal antialiased transition-colors duration-300`}>
                <ServiceWorkerRegistration />
                <ThemeProvider>
                    <AIConsentProvider>
                        <AIConsentModal />
                        <NetworkStatusBanner />
                        {children}
                    </AIConsentProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
