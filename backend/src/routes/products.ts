import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authenticateToken, requireRole } from '../middlewares/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();
const prisma = new PrismaClient();

const productSchema = z.object({
  name: z.string().min(2, 'Product name is required'),
  sku: z.string().min(3, 'SKU must be at least 3 characters').toUpperCase(),
  category: z.string().min(2, 'Category is required'),
  unitPrice: z.number().positive('Price must be greater than zero'),
  currentStock: z.number().int().nonnegative('Stock cannot be negative').default(0),
  minStockAlert: z.number().int().nonnegative('Min stock alert cannot be negative').default(10),
  location: z.string().min(2, 'Warehouse location/aisle is required')
});

const stockAdjustSchema = z.object({
  quantity: z.number().int().positive('Quantity must be greater than zero'),
  movementType: z.enum(['IN', 'OUT']),
  reason: z.string().min(3, 'Reason must be at least 3 characters')
});

// GET /api/products - Get list of products with search and filter
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { search, category, lowStock } = req.query;

    const where: any = {};

    if (search) {
      const searchStr = search as string;
      where.OR = [
        { name: { contains: searchStr } },
        { sku: { contains: searchStr } }
      ];
    }

    if (category) {
      where.category = category as string;
    }

    const products = await prisma.product.findMany({
      where,
      orderBy: { name: 'asc' }
    });

    // Client-side or database-level filter for low stock
    let filteredProducts = products;
    if (lowStock === 'true') {
      filteredProducts = products.filter(p => p.currentStock <= p.minStockAlert);
    }

    return res.json(filteredProducts);
  } catch (error) {
    console.error('Fetch products error:', error);
    return res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// POST /api/products - Add product
router.post('/', authenticateToken, requireRole(['Admin', 'Warehouse']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parseResult = productSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const data = parseResult.data;

    // Check SKU uniqueness
    const existing = await prisma.product.findUnique({ where: { sku: data.sku } });
    if (existing) {
      return res.status(400).json({ error: 'Product with this SKU already exists' });
    }

    const product = await prisma.product.create({ data });

    // Log the initial stock intake if greater than 0
    if (product.currentStock > 0) {
      await prisma.stockLog.create({
        data: {
          productId: product.id,
          qtyChanged: product.currentStock,
          movementType: 'IN',
          reason: 'Initial stock intake on creation',
          createdBy: req.user?.name || 'System'
        }
      });
    }

    return res.status(201).json(product);
  } catch (error) {
    console.error('Create product error:', error);
    return res.status(500).json({ error: 'Failed to create product' });
  }
});

// PUT /api/products/:id - Update product details
router.put('/:id', authenticateToken, requireRole(['Admin', 'Warehouse']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = productSchema.partial().safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const data = parseResult.data;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (data.sku && data.sku !== existing.sku) {
      const skuDup = await prisma.product.findUnique({ where: { sku: data.sku } });
      if (skuDup) {
        return res.status(400).json({ error: 'Product with this SKU already exists' });
      }
    }

    const updated = await prisma.product.update({
      where: { id },
      data
    });

    return res.json(updated);
  } catch (error) {
    console.error('Update product error:', error);
    return res.status(500).json({ error: 'Failed to update product' });
  }
});

// GET /api/products/:id/logs - Fetch stock movement logs
router.get('/:id/logs', authenticateToken, requireRole(['Admin', 'Warehouse']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const logs = await prisma.stockLog.findMany({
      where: { productId: id },
      orderBy: { timestamp: 'desc' }
    });

    return res.json(logs);
  } catch (error) {
    console.error('Fetch stock logs error:', error);
    return res.status(500).json({ error: 'Failed to fetch stock logs' });
  }
});

// POST /api/products/:id/stock - Manual Stock Intake / Outtake
router.post('/:id/stock', authenticateToken, requireRole(['Admin', 'Warehouse']), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = stockAdjustSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0].message });
    }

    const { quantity, movementType, reason } = parseResult.data;

    // Transaction to update stock and log movement
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id } });
      if (!product) {
        throw new Error('Product not found');
      }

      let newStock = product.currentStock;
      if (movementType === 'IN') {
        newStock += quantity;
      } else {
        newStock -= quantity;
        if (newStock < 0) {
          throw new Error('Insufficient stock: stock level cannot drop below zero');
        }
      }

      const updatedProduct = await tx.product.update({
        where: { id },
        data: { currentStock: newStock }
      });

      const log = await tx.stockLog.create({
        data: {
          productId: id,
          qtyChanged: quantity,
          movementType,
          reason,
          createdBy: req.user?.name || 'System'
        }
      });

      return { product: updatedProduct, log };
    });

    return res.json(result);
  } catch (error: any) {
    console.error('Stock adjust error:', error);
    if (error.message === 'Product not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message.startsWith('Insufficient stock')) {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Failed to adjust stock levels' });
  }
});

export default router;
