const mongoose = require('mongoose');
const Company = require('./models/Company');
require('dotenv').config();

async function checkLogos() {
    try {
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/offtix');
        const companies = await Company.find({}, 'name logo');
        console.log('Companies with logos:');
        companies.forEach(c => {
            console.log(`- ${c.name}: ${c.logo || 'NO LOGO'}`);
        });
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

checkLogos();
