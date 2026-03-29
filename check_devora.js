const mongoose = require('mongoose');
require('dotenv').config();

const Company = require('./models/Company');

async function checkDevora() {
    await mongoose.connect(process.env.MONGODB_URI);
    const company = await Company.findOne({ name: 'Devora' });
    if (company) {
        console.log('Company: Devora');
        console.log('Designations:', JSON.stringify(company.designations, null, 2));
    } else {
        console.log('Company Devora not found');
    }
    await mongoose.disconnect();
}

checkDevora();
