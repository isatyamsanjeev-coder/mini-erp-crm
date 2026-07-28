import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken, requireRole } from '../middlewares/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();
const prisma = new PrismaClient();

const customerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  mobile: z.string().min(10, 'Mobile must be at least 10 digits'),
  email: z.string().email('Invalid email address'),
  businessName: z.string().min(2, 'Business name is required'),
  gstNumber: z.string().nullable().optional(),
  type: z.enum(['Retail', 'Wholesale', 'Distributor']),
  address: z.string().min(5, 'Address is required'),
  status: z.enum(['Lead', 'Active', 'Inactive']),
  followUpDate: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

const noteSchema = z.object({
  note: z.string().min(1, 'Note cannot be empty')
});

// GET /api/customers - List customers with search/filter/pagination
router.get('/', authenticateToken, requireRole(['Admin', 'Sales', 'Accounts']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, type, status, page = '1', limit = '10' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Build filter query
    const where: any = {};

    if (search) {
      const searchStr = search as string;
      where.OR = [
        { name: { contains: searchStr } },
        { mobile: { contains: searchStr } },
        { email: { contains: searchStr } },
        { businessName: { contains: searchStr } }
      ];
    }

    if (type) {
      where.type = type as string;
    }

    if (status) {
      where.status = status as string;
    }

    const [customers, total] = await prisma.$transaction([
      prisma.customer.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' }
      }),
      prisma.customer.count({ where })
    ]);

    return res.json({
      customers,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Fetch customers error:', error);
    return res.status(500).json({ error: 'Failed to fetch customers' });
  }
});

// GET /api/customers/:id - Get details with notes
router.get('/:id', authenticateToken, requireRole(['Admin', 'Sales', 'Accounts']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        followUps: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    return res.json(customer);
  } catch (error) {
    console.error('Fetch customer detail error:', error);
    return res.status(500).json({ error: 'Failed to fetch customer details' });
  }
});

// POST /api/customers - Create new customer
router.post('/', authenticateToken, requireRole(['Admin', 'Sales']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = customerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const data = parseResult.data;
    const followUpDateVal = data.followUpDate ? new Date(data.followUpDate) : null;

    const customer = await prisma.customer.create({
      data: {
        ...data,
        followUpDate: followUpDateVal
      }
    });

    // Create an initial follow-up note if notes are provided
    if (data.notes) {
      await prisma.followUpNote.create({
        data: {
          customerId: customer.id,
          note: data.notes,
          createdBy: req.user?.name || 'System'
        }
      });
    }

    return res.status(201).json(customer);
  } catch (error) {
    console.error('Create customer error:', error);
    return res.status(500).json({ error: 'Failed to create customer' });
  }
});

// PUT /api/customers/:id - Update customer
router.put('/:id', authenticateToken, requireRole(['Admin', 'Sales']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = customerSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const data = parseResult.data;
    const followUpDateVal = data.followUpDate ? new Date(data.followUpDate) : null;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        ...data,
        followUpDate: followUpDateVal
      }
    });

    return res.json(updated);
  } catch (error) {
    console.error('Update customer error:', error);
    return res.status(500).json({ error: 'Failed to update customer' });
  }
});

// POST /api/customers/:id/notes - Add follow-up note
router.post('/:id/notes', authenticateToken, requireRole(['Admin', 'Sales']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = noteSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { note } = parseResult.data;

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const followUpNote = await prisma.followUpNote.create({
      data: {
        customerId: id,
        note,
        createdBy: req.user?.name || 'System'
      }
    });

    return res.status(201).json(followUpNote);
  } catch (error) {
    console.error('Create follow-up note error:', error);
    return res.status(500).json({ error: 'Failed to create follow-up note' });
  }
});

export default router;
