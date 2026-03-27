const mongoose = require('mongoose');
require('dotenv').config();
const Company = require('../models/Company');

const updatePermissions = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const companies = await Company.find({});
        console.log(`Found ${companies.length} companies`);

        for (const company of companies) {
            let modified = false;
            company.designations.forEach(designation => {
                if (designation.permissions && designation.permissions.manageRecruitment === undefined) {
                    // Grant to high level roles by default
                    if (['Managing Director', 'HR Manager', 'Admin'].includes(designation.name) || designation.level <= 2) {
                        designation.permissions.manageRecruitment = true;
                    } else {
                        designation.permissions.manageRecruitment = false;
                    }
                    modified = true;
                }
            });

            if (modified) {
                await company.save();
                console.log(`Updated permissions for company: ${company.name}`);
            }
        }

        console.log('Successfully updated all company permissions');
        process.exit(0);
    } catch (error) {
        console.error('Error updating permissions:', error);
        process.exit(1);
    }
};

updatePermissions();
