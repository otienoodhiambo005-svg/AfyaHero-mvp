import { cn } from '@/lib/utils';

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Breadcrumb navigation component
 * Shows current location in page hierarchy
 * 
 * Usage:
 * ```tsx
 * <Breadcrumb items={[
 *   { label: 'Medical', href: '/portal/medical' },
 *   { label: 'Patients', href: '/portal/medical/patients' },
 *   { label: 'John Doe' }
 * ]} />
 * ```
 */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex items-center gap-1.5 text-sm flex-wrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const key = item.href ? `${item.href}-${item.label}` : `${item.label}-${index}`;
          
          return (
            <li key={key} className="flex items-center">
              {index > 0 && (
                <span className="text-slate/70 mx-1.5">/</span>
              )}
              
              {isLast || !item.href ? (
                <span 
                  className={cn(
                    'font-medium',
                    isLast ? 'text-ink' : 'text-slate'
                  )}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {item.label}
                </span>
              ) : (
                <a
                  href={item.href}
                  className="text-slate hover:text-ink transition-colors"
                >
                  {item.label}
                </a>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Auto-generate breadcrumbs from pathname
 * 
 * Usage:
 * ```tsx
 * const pathname = usePathname();
 * const items = generateBreadcrumbs(pathname, {
 *   'medical': 'Medical Portal',
 *   'patients': 'Patients'
 * });
 * ```
 */
export function generateBreadcrumbs(
  pathname: string,
  labels: Record<string, string> = {}
): BreadcrumbItem[] {
  const parts = pathname.split('/').filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [{ label: 'Home', href: '/' }];
  
  let currentPath = '';
  parts.forEach((part) => {
    currentPath += `/${part}`;
    const label = labels[part] || part.charAt(0).toUpperCase() + part.slice(1);
    breadcrumbs.push({ label, href: currentPath });
  });
  
  return breadcrumbs;
}
