const mongoose = require('mongoose');
const User = require('../models/User');
const Company = require('../models/Company');
const fs = require('fs');
const path = require('path');

// Designations to assign
const designations = [
    'System Architect', 'UI/UX Designer', 'Backend Developer', 'Frontend Developer',
    'Full Stack Developer', 'QA Engineer', 'DevOps Engineer', 'Product Manager',
    'Business Analyst', 'Data Analyst', 'HR Manager', 'Sales Manager', 'Marketing Specialist'
];

// Sample skills
const skillsList = ['JavaScript', 'Python', 'React', 'Node.js', 'MongoDB', 'AWS', 'Docker', 'Figma', 'Adobe XD', 'SQL', 'Git', 'Agile'];

// Fake names
const firstNames = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen'];
const lastNames = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin'];

const getRandomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const getRandomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateRandomUser = (index) => {
    const firstName = firstNames[index % firstNames.length];
    const lastName = lastNames[getRandomInt(0, lastNames.length - 1)];
    const name = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${getRandomInt(100, 999)}@offtix.com`; // Ensure uniqueness
    const password = `Pass${getRandomInt(1000, 9999)}!`;

    return { name, email, password };
};

const seedEmployees = async () => {
    try {
        // Use correct DB name
        await mongoose.connect('mongodb://localhost:27017/offtixdb', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');

        // Find Company - try strict name match first, then fallback to first company found
        let company = await Company.findOne({ name: { $regex: /offtix/i } });

        if (!company) {
            console.log('Company "Offtix" not found by name. Using the first available company.');
            company = await Company.findOne();
        }

        if (!company) {
            console.error('No companies found in the database. Please create a company first.');
            process.exit(1);
        }
        console.log(`Found company: ${company.name} (${company._id})`);

        // Ensure designations exist in company
        designations.forEach(d => {
            if (!company.designations.some(cd => cd.name === d)) {
                company.designations.push({
                    name: d,
                    description: d,
                    level: 5, // Default level
                    permissions: { viewEmployeeList: true }
                });
            }
        });
        await company.save();

        const createdUsers = [];
        const credentials = [];

        // Create 20 Users
        for (let i = 0; i < 20; i++) {
            const userData = generateRandomUser(i);

            // Check if user exists
            let user = await User.findOne({ email: userData.email });
            if (user) {
                console.log(`User ${userData.email} already exists, skipping...`);
                continue;
            }

            const designation = getRandomElement(designations);
            const salary = getRandomInt(40000, 150000);

            user = new User({
                name: userData.name,
                email: userData.email,
                password: userData.password,
                company: company._id,
                role: 'user', // Default role
                profile: {
                    title: designation,
                    skills: [getRandomElement(skillsList), getRandomElement(skillsList), getRandomElement(skillsList)],
                    location: getRandomElement(['New York', 'London', 'San Francisco', 'Berlin', 'Remote']),
                    phone: `+1-555-${getRandomInt(100, 999)}-${getRandomInt(1000, 9999)}`,
                    summary: `Experienced ${designation} with a passion for building great products.`
                }
            });

            await user.save();
            createdUsers.push(user);

            // Add to company members
            company.members.push({
                user: user._id,
                designation: designation,
                currentSalary: salary,
                salaryHistory: [{
                    amount: salary,
                    effectiveDate: new Date(),
                    reason: 'Initial Hire',
                    updatedBy: company.owner // Assigned by owner
                }],
                joinedAt: new Date()
            });

            credentials.push(`Name: ${userData.name}\nEmail: ${userData.email}\nPassword: ${userData.password}\nRole: ${designation}\nSalary: $${salary}\n----------------------------------------\n`);
            console.log(`Created user: ${userData.name} - ${designation}`);
        }

        await company.save();
        console.log(`Successfully added ${createdUsers.length} employees to ${company.name}`);

        // Determine the output path (Desktop)
        const outputPath = path.join(process.env.HOME || '/home/rueen', 'Desktop', 'offtix_employees_credentials.txt');
        fs.writeFileSync(outputPath, credentials.join('\n'));
        console.log(`Credentials saved to: ${outputPath}`);

        process.exit(0);
    } catch (error) {
        console.error('Error seeding employees:', error);
        process.exit(1);
    }
};

seedEmployees();
