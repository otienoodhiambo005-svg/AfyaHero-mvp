import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const healthNewsSources = [
  // Common sources for all roles
  {
    name: 'WHO News',
    url: 'https://www.who.int/rss-feeds/news-english.xml',
    role: 'all',
    regionCodes: ['KE', 'UG', 'TZ', 'RW'],
    enabled: true,
  },
  {
    name: 'MedlinePlus Health News',
    url: 'https://medlineplus.gov/feeds/news_en.xml',
    role: 'all',
    regionCodes: ['KE', 'UG', 'TZ', 'RW'],
    enabled: true,
  },
  {
    name: 'CDC Public Health Media',
    url: 'https://tools.cdc.gov/api/v2/resources/media/132608.rss',
    role: 'all',
    regionCodes: ['KE', 'UG', 'TZ', 'RW'],
    enabled: true,
  },
  
  // Reception-specific sources
  {
    name: 'Reception & Triage News',
    url: 'https://newsapi.org/v2/everything?q=triage+patient+screening+healthcare&language=en',
    role: 'reception',
    regionCodes: ['KE', 'UG', 'TZ', 'RW'],
    enabled: true,
  },
  {
    name: 'Maternal & Child Health',
    url: 'https://newsapi.org/v2/everything?q=maternal+child+health+vaccination&language=en',
    role: 'reception',
    regionCodes: ['KE', 'UG', 'TZ', 'RW'],
    enabled: true,
  },
  
  // Medical-specific sources
  {
    name: 'Clinical Guidelines',
    url: 'https://newsapi.org/v2/everything?q=clinical+guidelines+treatment+diagnosis&language=en',
    role: 'medical',
    regionCodes: ['KE', 'UG', 'TZ', 'RW'],
    enabled: true,
  },
  {
    name: 'Chronic Disease Management',
    url: 'https://newsapi.org/v2/everything?q=hypertension+diabetes+cardiovascular&language=en',
    role: 'medical',
    regionCodes: ['KE', 'UG', 'TZ', 'RW'],
    enabled: true,
  },
  {
    name: 'Infectious Disease Updates',
    url: 'https://newsapi.org/v2/everything?q=malaria+infection+disease+outbreak&language=en',
    role: 'medical',
    regionCodes: ['KE', 'UG', 'TZ', 'RW'],
    enabled: true,
  },
  
  // Lab-specific sources
  {
    name: 'Laboratory Medicine News',
    url: 'https://newsapi.org/v2/everything?q=laboratory+medicine+diagnostics+testing&language=en',
    role: 'lab',
    regionCodes: ['KE', 'UG', 'TZ', 'RW'],
    enabled: true,
  },
  {
    name: 'CDC Laboratory Outreach',
    url: 'https://tools.cdc.gov/api/v2/resources/media/316422.rss',
    role: 'lab',
    regionCodes: ['KE', 'UG', 'TZ', 'RW'],
    enabled: true,
  },
  {
    name: 'Pathology & Diagnostics',
    url: 'https://newsapi.org/v2/everything?q=pathology+diagnostics+specimen+analysis&language=en',
    role: 'lab',
    regionCodes: ['KE', 'UG', 'TZ', 'RW'],
    enabled: true,
  },
  
  // Pharmacy-specific sources
  {
    name: 'FDA Drug Safety',
    url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/medwatch-safety-alerts-human-medical-products-rss-feed',
    role: 'pharmacy',
    regionCodes: ['KE', 'UG', 'TZ', 'RW'],
    enabled: true,
  },
  {
    name: 'Medication Safety Updates',
    url: 'https://newsapi.org/v2/everything?q=medication+safety+adverse+drug+pharmacy&language=en',
    role: 'pharmacy',
    regionCodes: ['KE', 'UG', 'TZ', 'RW'],
    enabled: true,
  },
  {
    name: 'Pharmacy Practice News',
    url: 'https://newsapi.org/v2/everything?q=pharmacy+practice+medication+management&language=en',
    role: 'pharmacy',
    regionCodes: ['KE', 'UG', 'TZ', 'RW'],
    enabled: true,
  },
  
  // Admin-specific sources
  {
    name: 'Healthcare Management',
    url: 'https://newsapi.org/v2/everything?q=healthcare+management+hospital+administration&language=en',
    role: 'admin',
    regionCodes: ['KE', 'UG', 'TZ', 'RW'],
    enabled: true,
  },
  {
    name: 'Public Health Policy',
    url: 'https://newsapi.org/v2/everything?q=public+health+policy+health+system&language=en',
    role: 'admin',
    regionCodes: ['KE', 'UG', 'TZ', 'RW'],
    enabled: true,
  },
  {
    name: 'Healthcare Quality & Safety',
    url: 'https://newsapi.org/v2/everything?q=healthcare+quality+patient+safety+accreditation&language=en',
    role: 'admin',
    regionCodes: ['KE', 'UG', 'TZ', 'RW'],
    enabled: true,
  },
  
  // Regional African Health News
  {
    name: 'African Health News',
    url: 'https://newsapi.org/v2/everything?q=africa+health+medical+kenya+uganda+tanzania&language=en',
    role: 'all',
    regionCodes: ['KE', 'UG', 'TZ', 'RW'],
    enabled: true,
  },
  {
    name: 'East Africa Health',
    url: 'https://newsapi.org/v2/everything?q=east+africa+health+medical+nairobi+kampala&language=en',
    role: 'all',
    regionCodes: ['KE', 'UG', 'TZ', 'RW'],
    enabled: true,
  },
];

async function main() {
  console.log('🌱 Seeding health news feed sources...');

  // Check if Prisma client is generated
  if (!('healthNewsFeedSource' in prisma)) {
    console.error('❌ Prisma client not generated. Please run: npx prisma generate');
    console.log('💡 Run this command from pulse-core-nextjs/ directory');
    process.exit(1);
  }

  const prismaWithTypes = prisma as any;

  for (const source of healthNewsSources) {
    try {
      await prismaWithTypes.healthNewsFeedSource.upsert({
        where: { url: source.url },
        update: {
          name: source.name,
          role: source.role,
          regionCodes: source.regionCodes,
          enabled: source.enabled,
        },
        create: {
          name: source.name,
          url: source.url,
          role: source.role,
          regionCodes: source.regionCodes,
          enabled: source.enabled,
        },
      });
      console.log(`✅ Upserted: ${source.name}`);
    } catch (error) {
      console.error(`❌ Failed to upsert ${source.name}:`, error);
    }
  }

  console.log('✨ Health news feed sources seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding health news sources:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
