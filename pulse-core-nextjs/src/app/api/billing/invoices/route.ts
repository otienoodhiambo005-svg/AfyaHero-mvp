import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceApiGuard, readJsonBody } from '@/lib/api-security';
import { readIdempotencyCache, writeIdempotencyCache } from '@/lib/idempotency';
import { prisma } from '@/lib/database';
import { Prisma } from '@prisma/client';

const LineItemSchema = z.object({
  description: z.string().min(1).max(200),
  qty: z.number().int().min(1).max(100),
  unitPrice: z.number().min(0).max(1_000_000),
});

const InvoiceSchema = z.object({
  patient: z.string().min(2).max(120),
  lineItems: z.array(LineItemSchema).min(1),
  paymentMethod: z.enum(['Cash', 'M-Pesa', 'Card/Visa', 'Insurance']),
  paymentAmount: z.number().min(0).max(10_000_000),
});

const IDEMPOTENCY_HEADER = 'x-idempotency-key';

function generateInvoiceId() {
  const code = Math.floor(1000 + Math.random() * 9000);
  return `INV-${code}`;
}

function decimalToNumber(value: Prisma.Decimal | number) {
  if (typeof value === 'number') return value;
  return Number(value.toString());
}

export async function POST(req: NextRequest) {
  const guard = await enforceApiGuard(req, {
    scope: 'api:billing:invoices',
    roles: ['reception', 'admin', 'super_admin'],
  });
  if (guard.response) return guard.response;

  const body = await readJsonBody<unknown>(req);
  if (body instanceof NextResponse) return body;

  const parsed = InvoiceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid invoice payload.', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const idempotencyKey = req.headers.get(IDEMPOTENCY_HEADER)?.trim();
  if (idempotencyKey) {
    const cached = readIdempotencyCache(idempotencyKey);
    if (cached) {
      return NextResponse.json(cached.payload, { status: cached.status });
    }
  }

  const { patient, lineItems, paymentMethod, paymentAmount } = parsed.data;
  const amount = lineItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
  const paid = Math.min(paymentAmount, amount);
  const balance = amount - paid;
  const status = paid <= 0 ? 'Pending' : balance > 0 ? 'Partial' : 'Paid';
  const invoiceNo = generateInvoiceId();
  const matchedPatient = await prisma.patient.findFirst({
    where: {
      hospitalId: guard.session!.hospitalId,
      name: { equals: patient, mode: 'insensitive' },
    },
    select: { id: true, name: true },
  });

  const created = await prisma.invoice.create({
    data: {
      hospitalId: guard.session!.hospitalId,
      patientId: matchedPatient?.id,
      invoiceNo,
      items: lineItems as Prisma.InputJsonValue,
      subtotal: amount,
      amountDue: amount,
      amountPaid: paid,
      status: status.toLowerCase(),
      paymentMethod: paymentMethod.toLowerCase(),
      notes: `Created by ${guard.session!.id}`,
    },
  });

  const invoice = {
    id: created.invoiceNo,
    patient: matchedPatient?.name ?? patient,
    date: 'Just now',
    services: lineItems.map((item) => item.description).join(', '),
    amount: decimalToNumber(created.amountDue),
    paid: decimalToNumber(created.amountPaid),
    status,
  };

  const responsePayload = { success: true, invoice };
  if (idempotencyKey) {
    writeIdempotencyCache(idempotencyKey, { status: 201, payload: responsePayload });
  }

  return NextResponse.json(responsePayload, { status: 201 });
}
