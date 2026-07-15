/**
 * Pharmacy Formulary Management API
 * 
 * GET /api/pharmacy/formulary - List formulary medications
 * POST /api/pharmacy/formulary - Add medication to formulary
 * PUT /api/pharmacy/formulary/[id] - Update formulary entry
 * DELETE /api/pharmacy/formulary/[id] - Remove from formulary
 * 
 * Manages the hospital's approved medication list with
 * tier classifications, restrictions, and alternatives.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import logger from '@/lib/logger';
import { withAuthzAndTenant, AuthzContext } from '@/lib/middleware/withAuthzAndTenant';

interface FormularyEntry {
  id: string;
  genericName: string;
  brandNames: string[];
  category: string;
  dosageForms: string[];
  strengths: string[];
  tier: 'essential' | 'standard' | 'specialist' | 'restricted';
  isRestricted: boolean;
  requiresApproval: boolean;
  approvalRequiredFrom?: string[];
  maxQuantityPerRx: number;
  alternatives: string[];
  commonIndications: string[];
  contraindications: string[];
  stockStatus: 'available' | 'low' | 'out_of_stock';
  kshPrice: number;
  isActive: boolean;
  notes?: string;
}

// GET /api/pharmacy/formulary
export const GET = withAuthzAndTenant(async (
  request: NextRequest,
  { hospitalId }: AuthzContext
) => {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const formulary = await prisma.pharmacyInventory.findMany({
      where: {
        hospitalId,
        ...(category && { category }),
        ...(search && {
          OR: [
            { medicationName: { contains: search, mode: 'insensitive' } },
            { genericName: { contains: search, mode: 'insensitive' } },
          ],
        }),
        ...(includeInactive ? {} : { status: { not: 'inactive' } }),
      },
      orderBy: { medicationName: 'asc' },
    });

    // Get stock status for each item
    const formularyWithStatus: FormularyEntry[] = formulary.map(item => ({
      id: item.id,
      genericName: item.genericName || item.medicationName,
      brandNames: [],
      category: item.category || 'Uncategorized',
      dosageForms: item.unit ? [item.unit] : [],
      strengths: [],
      tier: 'standard',
      isRestricted: false,
      requiresApproval: false,
      approvalRequiredFrom: [],
      maxQuantityPerRx: item.maxStockLevel || 30,
      alternatives: [],
      commonIndications: [],
      contraindications: [],
      stockStatus: getStockStatus(item.stockQuantity, item.minStockLevel || 10),
      kshPrice: Number(item.unitPrice || 0),
      isActive: item.status !== 'inactive',
      notes: undefined,
    }));

    logger.info('Formulary retrieved', {
      hospitalId,
      count: formularyWithStatus.length,
      filters: { category, search },
    });

    return NextResponse.json({
      formulary: formularyWithStatus,
      categories: [...new Set(formulary.map(f => f.category).filter(Boolean))],
      tiers: ['essential', 'standard', 'specialist', 'restricted'],
      lastUpdated: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Formulary retrieval error', { error, hospitalId });
    return NextResponse.json(
      { error: 'Failed to retrieve formulary' },
      { status: 500 }
    );
  }
}, ['pharmacy', 'admin', 'medical']);

// POST /api/pharmacy/formulary
export const POST = withAuthzAndTenant(async (
  request: NextRequest,
  { hospitalId }: AuthzContext
) => {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.genericName) {
      return NextResponse.json(
        { error: 'genericName is required' },
        { status: 400 }
      );
    }

    const formularyEntry = await prisma.pharmacyInventory.create({
      data: {
        hospitalId,
        medicationName: body.genericName,
        genericName: body.genericName,
        category: body.category || 'Uncategorized',
        unit: Array.isArray(body.dosageForms) ? body.dosageForms[0] : body.unit,
        stockQuantity: body.stockQuantity || 0,
        minStockLevel: body.reorderLevel || body.minStockLevel || 10,
        maxStockLevel: body.maxQuantityPerRx || body.maxStockLevel || 30,
        unitPrice: body.kshPrice || body.unitPrice || 0,
        status: 'adequate',
      },
    });

    logger.info('Formulary entry created', {
      hospitalId,
      medicationId: formularyEntry.id,
      genericName: body.genericName,
    });

    return NextResponse.json({
      success: true,
      entry: formularyEntry,
    }, { status: 201 });
  } catch (error) {
    logger.error('Formulary creation error', { error, hospitalId });
    return NextResponse.json(
      { error: 'Failed to create formulary entry' },
      { status: 500 }
    );
  }
}, ['pharmacy', 'admin']);

function getStockStatus(quantity: number, reorderLevel: number): 'available' | 'low' | 'out_of_stock' {
  if (quantity <= 0) return 'out_of_stock';
  if (quantity <= reorderLevel) return 'low';
  return 'available';
}
