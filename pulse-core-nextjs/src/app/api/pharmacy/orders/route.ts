 
import { NextRequest, NextResponse } from 'next/server';
import { enforceApiGuard } from '@/lib/api-security';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';

export type PharmacyOrdersRxStatus =
  | 'Ready to Dispense'
  | 'Clarification Needed'
  | 'Awaiting Stock'
  | 'Dispensed'
  | 'On Hold';

export interface PharmacyOrderLineItem {
  name: string;
  instructions: string;
  policy: string;
}

export interface PharmacyOrderDto {
  prescriptionId: string;
  rx: string;
  patient: string;
  pid: string;
  prescriber: string;
  items: number;
  insurance: string;
  status: PharmacyOrdersRxStatus;
  priority: 'Urgent' | 'Normal';
  time: string;
  alert?: string;
  lineItems: PharmacyOrderLineItem[];
}

const TZ = 'Africa/Nairobi';
const timeFmt = new Intl.DateTimeFormat('en-KE', {
  timeZone: TZ,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function formatTime(d: Date): string {
  return timeFmt.format(d);
}

function mapPriority(dbPriority: string): 'Urgent' | 'Normal' {
  const p = dbPriority.toLowerCase();
  return p === 'urgent' || p === 'critical' ? 'Urgent' : 'Normal';
}

function prescriberLabel(
  fullName: string,
  title: string | null | undefined,
): string {
  const n = fullName.trim();
  if (/^dr\.?\s/i.test(n)) return n;
  const t = (title ?? '').trim();
  if (t.toLowerCase().startsWith('dr')) return `${t} ${n}`.trim();
  return n.length ? `Dr. ${n}` : 'Prescriber';
}

function formatPid(patientId: string, idNumber: string | null | undefined): string {
  if (idNumber && idNumber.trim().length > 0) return `PID-${idNumber.trim()}`;
  return `PID-${patientId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

const NEEDS_CLARIF = /clarif|ambiguous|verify\s*with|callback|question|dose\s*(issue|ambig)/i;

function mapDbToUiStatus(
  dbStatus: string,
  notes: string | null | undefined,
): { status: PharmacyOrdersRxStatus; alert?: string } {
  const s = dbStatus.toLowerCase();
  const noteStr = (notes ?? '').trim();

  if (s === 'dispensed') return { status: 'Dispensed' };
  if (s === 'cancelled') {
    return { status: 'On Hold', alert: noteStr || 'Order cancelled.' };
  }
  if (s === 'on-hold') {
    return { status: 'On Hold', alert: noteStr || 'On hold.' };
  }
  if (s === 'partial') {
    return {
      status: 'Awaiting Stock',
      alert: noteStr || 'Partial fill — remainder awaiting stock.',
    };
  }
  if (s === 'pending' && NEEDS_CLARIF.test(noteStr)) {
    return { status: 'Clarification Needed', alert: noteStr };
  }
  if (s === 'pending' || s === 'dispensing') {
    return { status: 'Ready to Dispense' };
  }
  return { status: 'On Hold', alert: noteStr || `Unknown status: ${dbStatus}` };
}

function mapInsurance(prescInsurance: string | null | undefined, provider: string | null | undefined): string {
  const a = (prescInsurance ?? '').trim();
  if (a.length > 0) return a;
  const b = (provider ?? '').trim();
  if (b.length > 0) return b;
  return 'Cash';
}

function mapItemsToLineItems(items: unknown): PharmacyOrderLineItem[] {
  if (!Array.isArray(items)) return [];
  return items.map((raw, idx) => {
    if (!raw || typeof raw !== 'object') {
      return {
        name: `Line ${idx + 1}`,
        instructions: '—',
        policy: 'Review',
      };
    }
    const o = raw as Record<string, unknown>;
    const drug = String(o.drug ?? o.name ?? 'Medication');
    const dose = String(o.dose ?? '');
    const freq = String(o.frequency ?? '');
    const dur = String(o.duration ?? '');
    const parts = [dose, freq, dur].filter((p) => p.length > 0);
    return {
      name: drug,
      instructions: parts.length ? parts.join(' • ') : 'As directed',
      policy: 'Approved',
    };
  });
}

export async function GET(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:pharmacy:orders',
    roles: ['pharmacy', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;

  if (!guard.session?.hospitalId) {
    return NextResponse.json({ error: 'Missing hospital context.' }, { status: 400 });
  }

  const hospitalId = guard.session.hospitalId;

  try {
    const rows = await prisma.prescription.findMany({
      where: { hospitalId },
      orderBy: { prescribedAt: 'desc' },
      take: 120,
      include: {
        patient: { select: { id: true, name: true, idNumber: true, insuranceProvider: true } },
        prescribedByProfile: { select: { fullName: true, title: true } },
      },
    });

    const orders: PharmacyOrderDto[] = rows.map(r => {
      const itemsArr = Array.isArray(r.items) ? r.items : [];
      const mapped = mapDbToUiStatus(r.status, r.notes);
      const lineItems = mapItemsToLineItems(r.items);
      const itemCount = itemsArr.length > 0 ? itemsArr.length : lineItems.length;

      return {
        prescriptionId: r.id,
        rx: r.rxNumber,
        patient: r.patient.name,
        pid: formatPid(r.patient.id, r.patient.idNumber),
        prescriber: prescriberLabel(
          r.prescribedByProfile.fullName,
          r.prescribedByProfile.title,
        ),
        items: itemCount > 0 ? itemCount : 1,
        insurance: mapInsurance(r.insurance, r.patient.insuranceProvider),
        status: mapped.status,
        priority: mapPriority(r.priority),
        time: formatTime(r.prescribedAt),
        alert: mapped.alert,
        lineItems: lineItems.length > 0 ? lineItems : [{ name: 'Prescription', instructions: 'See chart', policy: 'Review' }],
      };
    });

    return NextResponse.json({ orders }, { status: 200 });
  } catch (error) {
    logger.error('Pharmacy orders GET failed', {
      error: error instanceof Error ? error.message : String(error),
      hospitalId,
    });
    return NextResponse.json({ error: 'Could not load prescription orders.' }, { status: 500 });
  }
}
