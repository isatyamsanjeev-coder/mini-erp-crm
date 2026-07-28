"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const challanItemInput = zod_1.z.object({
    productId: zod_1.z.string().min(1, 'Product ID is required'),
    quantity: zod_1.z.number().int().positive('Quantity must be greater than zero')
});
const createChallanSchema = zod_1.z.object({
    customerId: zod_1.z.string().min(1, 'Customer ID is required'),
    status: zod_1.z.enum(['Draft', 'Confirmed']),
    items: zod_1.z.array(challanItemInput).min(1, 'At least one product item is required')
});
const updateStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['Confirmed', 'Cancelled'])
});
// Helper: Generate Sequential Challan Number (Format: CH-YYYY-XXXX)
async function generateChallanNumber() {
    const currentYear = new Date().getFullYear();
    const prefix = `CH-${currentYear}-`;
    const lastChallan = await prisma.challan.findFirst({
        where: {
            challanNumber: {
                startsWith: prefix
            }
        },
        orderBy: {
            challanNumber: 'desc'
        }
    });
    let nextSerial = 1;
    if (lastChallan) {
        const parts = lastChallan.challanNumber.split('-');
        const lastSerial = parseInt(parts[2], 10);
        if (!isNaN(lastSerial)) {
            nextSerial = lastSerial + 1;
        }
    }
    const serialStr = String(nextSerial).padStart(4, '0');
    return `${prefix}${serialStr}`;
}
// GET /api/challans - List all challans
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { status, search } = req.query;
        const where = {};
        if (status) {
            where.status = status;
        }
        if (search) {
            const searchStr = search;
            where.OR = [
                { challanNumber: { contains: searchStr } },
                {
                    customer: {
                        OR: [
                            { name: { contains: searchStr } },
                            { businessName: { contains: searchStr } }
                        ]
                    }
                }
            ];
        }
        const challans = await prisma.challan.findMany({
            where,
            include: {
                customer: {
                    select: {
                        name: true,
                        businessName: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        return res.json(challans);
    }
    catch (error) {
        console.error('Fetch challans error:', error);
        return res.status(500).json({ error: 'Failed to fetch challans' });
    }
});
// GET /api/challans/:id - Fetch single challan with items
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const challan = await prisma.challan.findUnique({
            where: { id },
            include: {
                customer: true,
                items: true
            }
        });
        if (!challan) {
            return res.status(404).json({ error: 'Challan not found' });
        }
        return res.json(challan);
    }
    catch (error) {
        console.error('Fetch challan details error:', error);
        return res.status(500).json({ error: 'Failed to fetch challan details' });
    }
});
// POST /api/challans - Create a Challan (Draft or Confirmed)
router.post('/', auth_1.authenticateToken, (0, auth_1.requireRole)(['Admin', 'Sales']), async (req, res) => {
    try {
        const parseResult = createChallanSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ error: parseResult.error.errors[0].message });
        }
        const { customerId, status, items } = parseResult.data;
        // Check if customer exists
        const customer = await prisma.customer.findUnique({ where: { id: customerId } });
        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        // Atomic transaction for creation & potential stock deduction
        const result = await prisma.$transaction(async (tx) => {
            // Validate stock levels and build snapshot items
            const itemsWithSnapshots = [];
            let totalQty = 0;
            for (const item of items) {
                const product = await tx.product.findUnique({ where: { id: item.productId } });
                if (!product) {
                    throw new Error(`Product ID ${item.productId} not found`);
                }
                // If Confirmed, check stock level
                if (status === 'Confirmed') {
                    if (product.currentStock < item.quantity) {
                        throw new Error(`Insufficient stock for "${product.name}". Required: ${item.quantity}, Available: ${product.currentStock}`);
                    }
                    // Reduce stock level
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { currentStock: product.currentStock - item.quantity }
                    });
                }
                totalQty += item.quantity;
                itemsWithSnapshots.push({
                    productId: product.id,
                    name: product.name,
                    sku: product.sku,
                    unitPrice: product.unitPrice,
                    quantity: item.quantity
                });
            }
            // Generate unique Challan Number
            const challanNumber = await generateChallanNumber();
            // Create Challan
            const newChallan = await tx.challan.create({
                data: {
                    challanNumber,
                    customerId,
                    totalQuantity: totalQty,
                    status,
                    createdBy: req.user?.name || 'Sales User',
                    items: {
                        create: itemsWithSnapshots
                    }
                },
                include: {
                    items: true
                }
            });
            // Log stock movement if Confirmed
            if (status === 'Confirmed') {
                for (const item of items) {
                    await tx.stockLog.create({
                        data: {
                            productId: item.productId,
                            qtyChanged: item.quantity,
                            movementType: 'OUT',
                            reason: `Challan ${challanNumber} Confirmation`,
                            createdBy: req.user?.name || 'Sales User'
                        }
                    });
                }
            }
            return newChallan;
        });
        return res.status(201).json(result);
    }
    catch (error) {
        console.error('Create challan error:', error);
        if (error.message.startsWith('Product ID') || error.message.startsWith('Insufficient stock')) {
            return res.status(400).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Failed to create sales challan' });
    }
});
// PUT /api/challans/:id/status - Confirm Draft or Cancel Confirmed
router.put('/:id/status', auth_1.authenticateToken, (0, auth_1.requireRole)(['Admin', 'Sales', 'Warehouse']), async (req, res) => {
    try {
        const { id } = req.params;
        const parseResult = updateStatusSchema.safeParse(req.body);
        if (!parseResult.success) {
            return res.status(400).json({ error: parseResult.error.errors[0].message });
        }
        const { status: targetStatus } = parseResult.data;
        const result = await prisma.$transaction(async (tx) => {
            // Fetch current challan state with items
            const challan = await tx.challan.findUnique({
                where: { id },
                include: { items: true }
            });
            if (!challan) {
                throw new Error('Challan not found');
            }
            if (challan.status === targetStatus) {
                throw new Error(`Challan is already ${targetStatus}`);
            }
            // Transition check: Draft -> Confirmed
            if (challan.status === 'Draft' && targetStatus === 'Confirmed') {
                // Validate and reduce stock for all items
                for (const item of challan.items) {
                    const product = await tx.product.findUnique({ where: { id: item.productId } });
                    if (!product) {
                        throw new Error(`Product ${item.name} (${item.sku}) no longer exists in inventory database`);
                    }
                    if (product.currentStock < item.quantity) {
                        throw new Error(`Insufficient stock for "${product.name}". Required: ${item.quantity}, Available: ${product.currentStock}`);
                    }
                    // Deduct stock
                    await tx.product.update({
                        where: { id: item.productId },
                        data: { currentStock: product.currentStock - item.quantity }
                    });
                    // Log stock movement
                    await tx.stockLog.create({
                        data: {
                            productId: item.productId,
                            qtyChanged: item.quantity,
                            movementType: 'OUT',
                            reason: `Challan ${challan.challanNumber} Transition to Confirmed`,
                            createdBy: req.user?.name || 'System'
                        }
                    });
                }
            }
            // Transition check: Confirmed -> Cancelled (Revert stocks)
            else if (challan.status === 'Confirmed' && targetStatus === 'Cancelled') {
                for (const item of challan.items) {
                    const product = await tx.product.findUnique({ where: { id: item.productId } });
                    if (product) {
                        // Restore stock level
                        await tx.product.update({
                            where: { id: item.productId },
                            data: { currentStock: product.currentStock + item.quantity }
                        });
                        // Log stock restoration
                        await tx.stockLog.create({
                            data: {
                                productId: item.productId,
                                qtyChanged: item.quantity,
                                movementType: 'IN',
                                reason: `Challan ${challan.challanNumber} Cancelled - Stock Restored`,
                                createdBy: req.user?.name || 'System'
                            }
                        });
                    }
                }
            }
            // Attempting to cancel a draft directly, or transition cancelled back to confirmed/draft is disallowed or simpler
            else if (challan.status === 'Draft' && targetStatus === 'Cancelled') {
                // No stock adjustments needed for Draft -> Cancelled
            }
            else {
                throw new Error(`Invalid status transition from ${challan.status} to ${targetStatus}`);
            }
            // Update status
            const updatedChallan = await tx.challan.update({
                where: { id },
                data: { status: targetStatus },
                include: { items: true }
            });
            return updatedChallan;
        });
        return res.json(result);
    }
    catch (error) {
        console.error('Update challan status error:', error);
        if (error.message === 'Challan not found' ||
            error.message.startsWith('Challan is already') ||
            error.message.startsWith('Insufficient stock') ||
            error.message.startsWith('Invalid status transition') ||
            error.message.includes('no longer exists')) {
            return res.status(400).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Failed to update challan status' });
    }
});
exports.default = router;
