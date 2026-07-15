import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const roles = ['medical', 'lab', 'pharmacy', 'reception', 'admin'];

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function listPageRoutes(roleDir) {
  const routes = [];

  function walk(currentDir, relative = '') {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name === 'layout.tsx') continue;
      const full = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        walk(full, path.join(relative, entry.name));
      } else if (entry.isFile() && entry.name === 'page.tsx') {
        const route = relative
          ? `/portal/${path.basename(roleDir)}/${relative.replace(/\\/g, '/')}`
          : `/portal/${path.basename(roleDir)}`;
        routes.push(route);
      }
    }
  }

  walk(roleDir, '');
  return routes.sort();
}

function parseNavHrefs(layoutContent) {
  const hrefs = new Set();
  const regex = /href:\s*'([^']+)'/g;
  let match;
  while ((match = regex.exec(layoutContent)) !== null) {
    if (match[1].startsWith('/portal/')) hrefs.add(match[1]);
  }
  return [...hrefs].sort();
}

let hasFailures = false;

for (const role of roles) {
  const roleDir = path.join(root, 'src', 'app', 'portal', role);
  const layoutPath = path.join(roleDir, 'layout.tsx');

  if (!exists(layoutPath)) {
    console.log(`[${role}] missing layout.tsx`);
    hasFailures = true;
    continue;
  }

  const navHrefs = parseNavHrefs(read(layoutPath));
  const pageRoutes = listPageRoutes(roleDir);

  const missingPageFiles = navHrefs.filter((href) => {
    const local = href.replace(`/portal/${role}`, '');
    const target = local
      ? path.join(roleDir, local.replace(/^\//, ''), 'page.tsx')
      : path.join(roleDir, 'page.tsx');
    return !exists(target);
  });

  const missingNavLinks = pageRoutes.filter((route) => {
    if (navHrefs.includes(route)) return false;

    // Treat '/portal/<role>' and '/portal/<role>/dashboard' as equivalent dashboard entries.
    const dashboardRoute = `/portal/${role}/dashboard`;
    const rootRoute = `/portal/${role}`;
    if (route === dashboardRoute && navHrefs.includes(rootRoute)) return false;
    if (route === rootRoute && navHrefs.includes(dashboardRoute)) return false;

    return true;
  });

  if (missingPageFiles.length || missingNavLinks.length) {
    hasFailures = true;
    console.log(`\n[${role}] issues found`);
    if (missingPageFiles.length) {
      console.log('  nav href without page:');
      for (const href of missingPageFiles) console.log(`    - ${href}`);
    }
    if (missingNavLinks.length) {
      console.log('  page without nav href:');
      for (const route of missingNavLinks) console.log(`    - ${route}`);
    }
  } else {
    console.log(`[${role}] ok (pages=${pageRoutes.length}, nav=${navHrefs.length})`);
  }
}

if (hasFailures) {
  process.exitCode = 1;
}
