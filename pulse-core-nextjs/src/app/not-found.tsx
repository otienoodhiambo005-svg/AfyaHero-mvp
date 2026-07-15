import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#1B262C] flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="text-8xl font-bold text-white/10 mb-4 font-mono">404</div>
        <h1 className="text-2xl font-bold text-white mb-2">Page Not Found</h1>
        <p className="text-[#89C4E8] text-sm mb-8">
          The page you&apos;re looking for doesn&apos;t exist or you may not have access.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#3282B8] hover:bg-[#2A6E9E] text-white text-sm font-medium rounded-xl transition-colors"
        >
          ← Back to AfyaHero
        </Link>
      </div>
    </div>
  );
}
