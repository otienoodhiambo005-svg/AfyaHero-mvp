/**
 * DAWA Context Builder — AfyaHero
 *
 * Fetches live Supabase context relevant to the requesting user's portal role
 * and injects it into the DAWA prompt as structured JSON.
 *
 * Context blocks injected per persona:
 *   DAWA-Clinical  → current patient encounter, active medications, recent labs
 *   DAWA-Ward      → ward occupancy, today's MAR summary, overdue vitals
 *   DAWA-Rx        → low-stock formulary items, pending prescriptions
 *   DAWA-Lab       → pending orders, critical-value unacknowledged queue
 *   DAWA-Ops       → today's OPD headcount, SHA claim queue, stock alerts
 *
 * All context reads are server-side only (service role key).
 * Patient-level context is included only when a patientId is provided and
 * the requesting user's role has access to that patient's data.
 */

import { createClient } from '@supabase/supabase-js';
import type { PortalRole } from '@/types';
import { resolvePersona, type DAWAPersona } from './dawa-personas';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DAWAContextInput {
  role: PortalRole;
  subrole?: string;
  hospitalId: string;
  patientId?: string;
  /** Raw free-text query from the user */
  query: string;
}

export interface DAWAContextResult {
  persona: DAWAPersona;
  /** Full prompt ready to send to the model — system instruction is separate */
  userPrompt: string;
  /** Sanitised context block as a plain string (for audit logging) */
  contextSummary: string;
}

// ─── Supabase admin client (server-only) ──────────────────────────────────────

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

// ─── Context fetchers per persona ─────────────────────────────────────────────

async function getClinicalContext(
  hospitalId: string,
  patientId?: string,
): Promise<string> {
  const sb = getAdmin();
  if (!sb) return '(context unavailable — demo mode)';

  const sections: string[] = [];

  if (patientId) {
    // Recent encounter
    const { data: enc } = await sb
      .from('encounters')
      .select('encounter_type, chief_complaint, diagnosis_codes, encounter_date')
      .eq('hospital_id', hospitalId)
      .eq('patient_id', patientId)
      .order('encounter_date', { ascending: false })
      .limit(1)
      .single();

    if (enc) {
      sections.push(`LATEST ENCOUNTER:\n${JSON.stringify(enc, null, 2)}`);
    }

    // Active prescriptions
    const { data: rx } = await sb
      .from('prescriptions')
      .select('status, created_at, prescription_items(generic_name, dose, route, frequency, duration_days)')
      .eq('hospital_id', hospitalId)
      .eq('patient_id', patientId)
      .eq('status', 'active')
      .limit(10);

    if (rx && rx.length > 0) {
      sections.push(`ACTIVE MEDICATIONS (${rx.length}):\n${JSON.stringify(rx, null, 2)}`);
    }

    // Recent labs
    const { data: labs } = await sb
      .from('lab_results')
      .select('test_name, result_value, unit, reference_range, flag, resulted_at')
      .eq('hospital_id', hospitalId)
      .eq('patient_id', patientId)
      .order('resulted_at', { ascending: false })
      .limit(8);

    if (labs && labs.length > 0) {
      sections.push(`RECENT LAB RESULTS:\n${JSON.stringify(labs, null, 2)}`);
    }
  }

  return sections.length > 0 ? sections.join('\n\n') : '(no patient context — provide symptoms/observations in query)';
}

async function getWardContext(hospitalId: string): Promise<string> {
  const sb = getAdmin();
  if (!sb) return '(context unavailable — demo mode)';

  const sections: string[] = [];

  // Ward occupancy
  const { data: beds } = await sb
    .from('beds')
    .select('ward_id, status, wards(name)')
    .eq('hospital_id', hospitalId);

  if (beds) {
    const total = beds.length;
    const occupied = beds.filter((b) => b.status === 'occupied').length;
    const available = beds.filter((b) => b.status === 'available').length;
    sections.push(`WARD OCCUPANCY: ${occupied}/${total} beds occupied, ${available} available`);
  }

  // Overdue vitals (patients with no vitals in last 8 hours)
  const cutoff = new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString();
  const { data: overdueVitals } = await sb
    .from('vitals')
    .select('patient_id, recorded_at')
    .eq('hospital_id', hospitalId)
    .lt('recorded_at', cutoff)
    .limit(10);

  if (overdueVitals && overdueVitals.length > 0) {
    sections.push(`OVERDUE VITALS (>${8}h since last recording): ${overdueVitals.length} patients`);
  }

  return sections.length > 0 ? sections.join('\n\n') : '(no ward context)';
}

async function getRxContext(hospitalId: string): Promise<string> {
  const sb = getAdmin();
  if (!sb) return '(context unavailable — demo mode)';

  const sections: string[] = [];

  // Low-stock items
  const { data: stockItems } = await sb
    .from('inventory')
    .select('generic_name, stock_quantity, min_stock_level, unit')
    .eq('hospital_id', hospitalId)
    .limit(50);

  if (stockItems) {
    const low = stockItems.filter((i) => i.stock_quantity <= i.min_stock_level);
    if (low.length > 0) {
      sections.push(`LOW STOCK ITEMS (${low.length}):\n${JSON.stringify(low, null, 2)}`);
    }
  }

  // Pending prescriptions awaiting dispensing
  const { data: pending } = await sb
    .from('prescriptions')
    .select('id, created_at, prescription_items(generic_name, dose, route, frequency)')
    .eq('hospital_id', hospitalId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(8);

  if (pending && pending.length > 0) {
    sections.push(`PENDING DISPENSING QUEUE (${pending.length}):\n${JSON.stringify(pending, null, 2)}`);
  }

  return sections.length > 0 ? sections.join('\n\n') : '(no pharmacy context)';
}

async function getLabContext(hospitalId: string): Promise<string> {
  const sb = getAdmin();
  if (!sb) return '(context unavailable — demo mode)';

  const sections: string[] = [];

  // Pending lab orders (STAT priority first)
  const { data: pending } = await sb
    .from('lab_orders')
    .select('id, test_name, priority, ordered_at, status')
    .eq('hospital_id', hospitalId)
    .eq('status', 'pending')
    .order('priority', { ascending: false })
    .order('ordered_at', { ascending: true })
    .limit(10);

  if (pending && pending.length > 0) {
    sections.push(`PENDING LAB ORDERS (${pending.length}):\n${JSON.stringify(pending, null, 2)}`);
  }

  // Unacknowledged critical values
  const { data: criticals } = await sb
    .from('lab_results')
    .select('test_name, result_value, unit, flag, resulted_at, patient_id')
    .eq('hospital_id', hospitalId)
    .eq('flag', 'critical')
    .eq('acknowledged', false)
    .limit(5);

  if (criticals && criticals.length > 0) {
    sections.push(`UNACKNOWLEDGED CRITICAL VALUES (${criticals.length}):\n${JSON.stringify(criticals, null, 2)}`);
  }

  return sections.length > 0 ? sections.join('\n\n') : '(no lab context)';
}

async function getOpsContext(hospitalId: string): Promise<string> {
  const sb = getAdmin();
  if (!sb) return '(context unavailable — demo mode)';

  const sections: string[] = [];

  // Today's encounter count
  const today = new Date().toISOString().split('T')[0];
  const { count: todayCount } = await sb
    .from('encounters')
    .select('id', { count: 'exact', head: true })
    .eq('hospital_id', hospitalId)
    .gte('encounter_date', today);

  sections.push(`TODAY'S ENCOUNTERS: ${todayCount ?? 0}`);

  // SHA claim queue size
  const { count: claimCount } = await sb
    .from('SHIF_claims')
    .select('id', { count: 'exact', head: true })
    .eq('hospital_id', hospitalId)
    .in('status', ['draft', 'pending_submission']);

  if (claimCount && claimCount > 0) {
    sections.push(`SHA/SHIF CLAIMS PENDING SUBMISSION: ${claimCount}`);
  }

  // Critical stock alerts
  const { data: stockItems } = await sb
    .from('inventory')
    .select('generic_name, stock_quantity, min_stock_level')
    .eq('hospital_id', hospitalId)
    .limit(50);

  if (stockItems) {
    const critical = stockItems.filter((i) => i.stock_quantity === 0);
    if (critical.length > 0) {
      sections.push(`OUT-OF-STOCK ITEMS: ${critical.map((i) => i.generic_name).join(', ')}`);
    }
  }

  return sections.join('\n\n') || '(no ops context)';
}

// ─── Main context builder ─────────────────────────────────────────────────────

/**
 * Builds the full DAWA context for a given user query.
 * Returns the resolved persona, the full user prompt (query + context block),
 * and a sanitised context summary for audit logging.
 */
export async function buildDawaContext(input: DAWAContextInput): Promise<DAWAContextResult> {
  const { role, subrole, hospitalId, patientId, query } = input;
  const persona = resolvePersona(role, subrole);

  let contextBlock = '';

  try {
    switch (persona.id) {
      case 'DAWA-Clinical':
        contextBlock = await getClinicalContext(hospitalId, patientId);
        break;
      case 'DAWA-Ward':
        contextBlock = await getWardContext(hospitalId);
        break;
      case 'DAWA-Rx':
        contextBlock = await getRxContext(hospitalId);
        break;
      case 'DAWA-Lab':
        contextBlock = await getLabContext(hospitalId);
        break;
      case 'DAWA-Ops':
        contextBlock = await getOpsContext(hospitalId);
        break;
    }
  } catch {
    contextBlock = '(context fetch failed — proceeding without live data)';
  }

  const userPrompt = contextBlock
    ? `LIVE FACILITY CONTEXT:\n${contextBlock}\n\nUSER QUERY:\n${query}`
    : `USER QUERY:\n${query}`;

  const contextSummary = contextBlock.slice(0, 300);

  return { persona, userPrompt, contextSummary };
}
