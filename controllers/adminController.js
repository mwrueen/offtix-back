const Company = require('../models/Company');
const User = require('../models/User');

// Get superadmin statistics
exports.getStats = async (req, res) => {
    try {
        // Check if user is superadmin
        if (req.user.role !== 'superadmin') {
            return res.status(403).json({ error: 'Access denied. Only superadmin can view statistics.' });
        }

        // Get total companies count
        const totalCompanies = await Company.countDocuments();

        // Get total users count
        const totalUsers = await User.countDocuments();

        // Get active users count (users who have logged in within last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const activeUsers = await User.countDocuments({
            lastLogin: { $gte: thirtyDaysAgo }
        });

        // Get admin users count
        const adminUsers = await User.countDocuments({
            role: { $in: ['admin', 'superadmin'] }
        });

        res.json({
            totalCompanies,
            totalUsers,
            activeUsers,
            adminUsers
        });
    } catch (error) {
        console.error('Error fetching admin statistics:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get all companies with overview data
exports.getAllCompanies = async (req, res) => {
    try {
        // Check if user is superadmin or admin
        if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Only superadmin and admin can view all companies.' });
        }

        // Fetch all companies with owner and member information
        const companies = await Company.find()
            .populate('owner', 'name email')
            .select('name description industry website email phone address city state country zipCode foundedYear companySize currency members owner createdAt')
            .lean();

        // Add member count and format data
        const companiesWithOverview = companies.map(company => ({
            id: company._id,
            name: company.name,
            description: company.description,
            industry: company.industry,
            website: company.website,
            email: company.email,
            phone: company.phone,
            address: company.address,
            city: company.city,
            state: company.state,
            country: company.country,
            zipCode: company.zipCode,
            foundedYear: company.foundedYear,
            companySize: company.companySize,
            currency: company.currency,
            memberCount: company.members?.length || 0,
            owner: company.owner,
            createdAt: company.createdAt
        }));

        res.json(companiesWithOverview);
    } catch (error) {
        console.error('Error fetching companies:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get specific company details
exports.getCompanyDetails = async (req, res) => {
    try {
        // Check if user is superadmin or admin
        if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Only superadmin and admin can view company details.' });
        }

        const company = await Company.findById(req.params.id)
            .populate('owner', 'name email avatar')
            .populate('members.user', 'name email avatar role')
            .lean();

        if (!company) {
            return res.status(404).json({ error: 'Company not found' });
        }

        // Add member count and format data
        const companyDetails = {
            ...company,
            memberCount: company.members?.length || 0,
        };

        res.json(companyDetails);
    } catch (error) {
        console.error('Error fetching company details:', error);
        res.status(500).json({ error: error.message });
    }
};

// Get projects for a specific company
exports.getCompanyProjects = async (req, res) => {
    try {
        // Check if user is superadmin or admin
        if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied. Only superadmin and admin can view company projects.' });
        }

        // Project requires explicit import if not at top
        const Project = require('../models/Project');

        const projects = await Project.find({ company: req.params.id })
            .populate('owner', 'name email')
            .populate('members.user', 'name email')
            .sort({ createdAt: -1 })
            .lean();

        res.json(projects);
    } catch (error) {
        console.error('Error fetching company projects:', error);
        res.status(500).json({ error: error.message });
    }
};
