"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const auth_1 = require("../middlewares/auth");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const customerSchema = zod_1.z.object({
    name: zod_1.z.string().min(2, 'Name must be at least 2 characters'),
    mobile: zod_1.z.string().min(10, 'Mobile must be at least 10 digits'),
    email: zod_1.z.string().email('Invalid email address'),
    businessName: zod_1.z.string().min(2, 'Business name is required'),
    gstNumber: zod_1.z.string().nullable().optional(),
    type: zod_1.z.enum(['Retail', 'Wholesale', 'Distributor']),
    address: zod_1.z.string().min(5, 'Address is required'),
    status: zod_1.z.enum(['Lead', 'Active', 'Inactive']),
    followUpDate: zod_1.z.string().nullable().optional(),
    notes: zod_1.z.string().nullable().optional()
});
const noteSchema = zod_1.z.object({
    note: zod_1.z.string().min(1, 'Note cannot be empty')
});
// GET /api/customers - List customers with search/filter/pagination
router.get('/', auth_1.authenticateToken, (0, auth_1.requireRole)(['Admin', 'Sales', 'Accounts']), async (req, res) => {
    try {
        const { search, type, status, page = '1', limit = '10' } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;
        // Build filter query
        const where = {};
        if (search) {
            const searchStr = search;
            where.OR = [
                { name: { contains: searchStr } },
                { mobile: { contains: searchStr } },
                { email: { contains: searchStr } },
                { businessName: { contains: searchStr } }
            ];
        }
        if (type) {
            where.type = type;
        }
        if (status) {
            where.status = status;
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
    }
    catch (error) {
        console.error('Fetch customers error:', error);
        return res.status(500).json({ error: 'Failed to fetch customers' });
    }
});
// GET /api/customers/:id - Get details with notes
router.get('/:id', auth_1.authenticateToken, (0, auth_1.requireRole)(['Admin', 'Sales', 'Accounts']), async (req, res) => {
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
    }
    catch (error) {
        console.error('Fetch customer detail error:', error);
        return res.status(500).json({ error: 'Failed to fetch customer details' });
    }
});
// POST /api/customers - Create new customer
router.post('/', auth_1.authenticateToken, (0, auth_1.requireRole)(['Admin', 'Sales']), async (req, res) => {
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
    }
    catch (error) {
        console.error('Create customer error:', error);
        return res.status(500).json({ error: 'Failed to create customer' });
    }
});
// PUT /api/customers/:id - Update customer
router.put('/:id', auth_1.authenticateToken, (0, auth_1.requireRole)(['Admin', 'Sales']), async (req, res) => {
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
    }
    catch (error) {
        console.error('Update customer error:', error);
        return res.status(500).json({ error: 'Failed to update customer' });
    }
});
// POST /api/customers/:id/notes - Add follow-up note
router.post('/:id/notes', auth_1.authenticateToken, (0, auth_1.requireRole)(['Admin', 'Sales']), async (req, res) => {
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
    }
    catch (error) {
        console.error('Create follow-up note error:', error);
        return res.status(500).json({ error: 'Failed to create follow-up note' });
    }
});
exports.default = router;
