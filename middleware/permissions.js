const Company = require('../models/Company');

/**
 * Helper to resolve user permissions for a given company
 * Returns the permission set for a user or null if not a member/owner
 */
const resolvePermissions = async (userId, userRole, company) => {
    const ownerId = company.owner?._id?.toString() || company.owner?.toString();
    const isOwner = ownerId === userId.toString();
    const isSuperAdmin = userRole === 'superadmin';

    if (isOwner || isSuperAdmin) {
        return {
            addEmployee: true,
            viewEmployeeList: true,
            editEmployee: true,
            createDesignation: true,
            viewDesignations: true,
            editDesignation: true,
            deleteDesignation: true,
            createProject: true,
            assignEmployeeToProject: true,
            removeEmployeeFromProject: true,
            manageCompanySettings: true
        };
    }

    const memberInfo = company.members?.find(m => {
        const memberId = m.user?._id?.toString() || m.user?.toString();
        return memberId === userId.toString();
    });

    if (memberInfo) {
        const designation = company.designations?.find(d => d.name === memberInfo.designation);
        if (designation?.permissions) {
            return designation.permissions;
        }
    }

    return null;
};

/**
 * Middleware factory: checks if user has a specific permission in the target company.
 * Looks for companyId from:
 *  1. req.params.id (company route)
 *  2. req.headers['x-company-id']
 *  3. req.query.companyId
 *  4. req.body.companyId
 */
const requirePermission = (permissionKey) => {
    return async (req, res, next) => {
        try {
            const companyId =
                req.params.id ||
                req.params.companyId ||
                req.headers['x-company-id'] ||
                req.query.companyId ||
                req.body.companyId;

            if (!companyId) {
                // No company context — skip permission check (personal mode)
                return next();
            }

            const company = await Company.findById(companyId)
                .select('owner members designations')
                .lean();

            if (!company) {
                return res.status(404).json({ message: 'Company not found' });
            }

            const userId = req.user._id;
            const userRole = req.user.role;

            const permissions = await resolvePermissions(userId, userRole, company);

            if (!permissions) {
                return res.status(403).json({
                    message: 'Access denied. You are not a member of this company.'
                });
            }

            if (!permissions[permissionKey]) {
                return res.status(403).json({
                    message: `Access denied. You do not have the '${permissionKey}' permission.`
                });
            }

            // Attach permissions to request for downstream use
            req.userPermissions = permissions;
            req.companyData = company;
            next();
        } catch (error) {
            console.error('Permission check error:', error);
            res.status(500).json({ message: 'Permission check failed' });
        }
    };
};

/**
 * Middleware: attaches user permissions for the company to the request without blocking.
 * Useful for routes where permission just needs to be READ, not enforced.
 */
const attachPermissions = async (req, res, next) => {
    try {
        const companyId =
            req.params.id ||
            req.params.companyId ||
            req.headers['x-company-id'] ||
            req.query.companyId ||
            req.body.companyId;

        if (!companyId || !req.user) {
            return next();
        }

        const company = await Company.findById(companyId)
            .select('owner members designations')
            .lean();

        if (company) {
            const permissions = await resolvePermissions(req.user._id, req.user.role, company);
            req.userPermissions = permissions;
            req.companyData = company;
        }

        next();
    } catch (error) {
        // Non-blocking: don't fail the request
        next();
    }
};

module.exports = { requirePermission, attachPermissions, resolvePermissions };
