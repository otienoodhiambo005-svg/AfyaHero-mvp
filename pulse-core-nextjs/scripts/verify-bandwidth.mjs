#!/usr/bin/env node
/**
 * Bandwidth Optimization Verification Script
 * 
 * Run: npm run verify-bandwidth
 * or: node scripts/verify-bandwidth.mjs
 * 
 * Checks:
 * - Image optimization configuration
 * - Font loading strategy
 * - Cache headers setup
 * - Service worker presence
 * - Bundle size estimates
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, text) {
  console.log(`${color}${text}${colors.reset}`);
}

function checkmark(condition, message) {
  if (condition) {
    log(colors.green, `✓ ${message}`);
    return true;
  } else {
    log(colors.red, `✗ ${message}`);
    return false;
  }
}

function collectManifestAssets(value, out = new Set()) {
  if (!value) return out;

  if (typeof value === 'string') {
    if (value.startsWith('static/')) {
      out.add(value);
    }
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectManifestAssets(item, out));
    return out;
  }

  if (typeof value === 'object') {
    Object.values(value).forEach((item) => collectManifestAssets(item, out));
  }

  return out;
}

async function verify() {
  let passCount = 0;
  let totalCount = 0;

  log(colors.cyan, '\n🔍 AfyaHero Bandwidth Optimization Verification\n');

  // 1. Check next.config.js
  log(colors.blue, '📋 Checking next.config.js...');
  const nextConfigPath = path.join(rootDir, 'next.config.js');
  if (fs.existsSync(nextConfigPath)) {
    const nextConfig = fs.readFileSync(nextConfigPath, 'utf-8');
    
    totalCount++;
    if (checkmark(nextConfig.includes("formats: ['image/avif', 'image/webp']"), 'Image format optimization (AVIF/WebP)')) {
      passCount++;
    }
    
    totalCount++;
    if (checkmark(nextConfig.includes('minimumCacheTTL: 60 * 60 * 24 * 365'), 'Image cache TTL (1 year)')) {
      passCount++;
    }
    
    totalCount++;
    if (checkmark(nextConfig.includes("'public, max-age=31536000, immutable'"), 'Static asset caching strategy')) {
      passCount++;
    }
  }

  // 2. Check layout.tsx for font optimization
  log(colors.blue, '📋 Checking src/app/layout.tsx...');
  const layoutPath = path.join(rootDir, 'src/app/layout.tsx');
  if (fs.existsSync(layoutPath)) {
    const layout = fs.readFileSync(layoutPath, 'utf-8');
    
    totalCount++;
    if (checkmark(layout.includes('display: "swap"'), 'Font display swap (prevent FOUT)')) {
      passCount++;
    }
    
    totalCount++;
    if (checkmark(layout.includes('preload: true'), 'Font preload enabled')) {
      passCount++;
    }
    
    totalCount++;
    if (checkmark(layout.includes('dns-prefetch'), 'DNS prefetch hints configured')) {
      passCount++;
    }
    
    totalCount++;
    if (checkmark(layout.includes('preconnect'), 'Preconnect hints configured')) {
      passCount++;
    }
  }

  // 3. Check OptimizedImage component
  log(colors.blue, '📋 Checking OptimizedImage component...');
  const optimizedImagePath = path.join(rootDir, 'src/components/shared/OptimizedImage.tsx');
  if (fs.existsSync(optimizedImagePath)) {
    totalCount++;
    checkmark(true, 'OptimizedImage component exists');
    passCount++;
  } else {
    totalCount++;
    checkmark(false, 'OptimizedImage component exists');
  }

  // 4. Check Service Worker
  log(colors.blue, '📋 Checking service worker...');
  const swPath = path.join(rootDir, 'public/sw.js');
  if (fs.existsSync(swPath)) {
    const sw = fs.readFileSync(swPath, 'utf-8');
    
    totalCount++;
    if (checkmark(sw.includes('STATIC_CACHE'), 'Service worker has static cache')) {
      passCount++;
    }
    
    totalCount++;
    if (checkmark(sw.includes('cacheFirst') || sw.includes('cache-first'), 'Cache-first strategy implemented')) {
      passCount++;
    }
    
    totalCount++;
    if (checkmark(sw.includes('Offline') || sw.includes('offline'), 'Offline support implemented')) {
      passCount++;
    }
  }

  // 5. Check Tailwind config
  log(colors.blue, '📋 Checking Tailwind configuration...');
  const tailwindPath = path.join(rootDir, 'tailwind.config.ts');
  if (fs.existsSync(tailwindPath)) {
    const tailwind = fs.readFileSync(tailwindPath, 'utf-8');
    
    totalCount++;
    if (checkmark(tailwind.includes('content:'), 'Tailwind content configured (CSS purging)')) {
      passCount++;
    }
  }

  // 6. Check PostCSS
  log(colors.blue, '📋 Checking PostCSS configuration...');
  const postcssPath = path.join(rootDir, 'postcss.config.js');
  totalCount++;
  if (checkmark(fs.existsSync(postcssPath), 'PostCSS configured')) {
    passCount++;
  }

  // 7. Bundle size estimate
  log(colors.blue, '📋 Checking build artifacts...');
  const nextBuildPath = path.join(rootDir, '.next');
  
  function getDirectorySize(dir) {
    if (!fs.existsSync(dir)) return 0;
    const files = fs.readdirSync(dir);
    return files.reduce((size, file) => {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      return size + (stat.isDirectory() ? getDirectorySize(fullPath) : stat.size);
    }, 0);
  }

  if (fs.existsSync(nextBuildPath)) {
    const buildManifestPath = path.join(nextBuildPath, 'build-manifest.json');
    const appBuildManifestPath = path.join(nextBuildPath, 'app-build-manifest.json');
    const referencedAssets = new Set();

    if (fs.existsSync(buildManifestPath)) {
      collectManifestAssets(JSON.parse(fs.readFileSync(buildManifestPath, 'utf-8')), referencedAssets);
    }
    if (fs.existsSync(appBuildManifestPath)) {
      collectManifestAssets(JSON.parse(fs.readFileSync(appBuildManifestPath, 'utf-8')), referencedAssets);
    }

    let measuredBytes = 0;
    let compressedBytes = 0;
    if (referencedAssets.size > 0) {
      for (const relativeAssetPath of referencedAssets) {
        if (!relativeAssetPath.endsWith('.js') && !relativeAssetPath.endsWith('.css')) {
          continue;
        }

        const absoluteAssetPath = path.join(nextBuildPath, relativeAssetPath);
        if (fs.existsSync(absoluteAssetPath)) {
          const fileBuffer = fs.readFileSync(absoluteAssetPath);
          measuredBytes += fileBuffer.length;
          compressedBytes += zlib.gzipSync(fileBuffer).length;
        }
      }
    } else {
      measuredBytes = getDirectorySize(path.join(nextBuildPath, 'static'));
      compressedBytes = measuredBytes;
    }

    const sizeMB = (measuredBytes / 1024 / 1024).toFixed(2);
    const compressedMB = (compressedBytes / 1024 / 1024).toFixed(2);
    const threshold = 5; // MB (gzip transfer size)
    const mode = referencedAssets.size > 0 ? 'manifest assets' : 'all static assets';

    totalCount++;
    if (checkmark(compressedBytes < threshold * 1024 * 1024, `Static bundle size reasonable (${compressedMB}MB gzipped / ${sizeMB}MB raw ${mode}, target: < ${threshold}MB gzipped)`)) {
      passCount++;
    } else {
      log(colors.yellow, `  💡 Consider code splitting or removing unused dependencies`);
    }
  } else {
    totalCount++;
    log(colors.yellow, '⚠ Build output not found. Run: npm run build');
  }

  // Summary
  log(colors.cyan, `\n✨ Results: ${passCount}/${totalCount} checks passed\n`);

  if (passCount === totalCount) {
    log(colors.green, '🎉 All bandwidth optimizations verified!');
    process.exit(0);
  } else {
    log(colors.yellow, `⚠ ${totalCount - passCount} optimization(s) need attention`);
    process.exit(1);
  }
}

verify().catch((err) => {
  log(colors.red, `❌ Error: ${err.message}`);
  process.exit(1);
});
