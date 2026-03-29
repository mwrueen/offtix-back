require('dotenv').config();
const mongoose = require('mongoose');
const Skill = require('./models/Skill');
const { connectDatabase } = require('./config/database');

const seedSkills = async () => {
    try {
        await connectDatabase();

        const skills = [
            { name: 'JavaScript', category: 'Programming Language' },
            { name: 'Python', category: 'Programming Language' },
            { name: 'Java', category: 'Programming Language' },
            { name: 'C#', category: 'Programming Language' },
            { name: 'PHP', category: 'Programming Language' },
            { name: 'Go', category: 'Programming Language' },
            { name: 'Rust', category: 'Programming Language' },
            { name: 'TypeScript', category: 'Programming Language' },
            { name: 'MongoDB', category: 'Database' },
            { name: 'PostgreSQL', category: 'Database' },
            { name: 'MySQL', category: 'Database' },
            { name: 'Redis', category: 'Database' },
            { name: 'Oracle', category: 'Database' },
            { name: 'UI Design', category: 'Design' },
            { name: 'UX Design', category: 'Design' },
            { name: 'Figma', category: 'Design' },
            { name: 'Adobe XD', category: 'Design' },
            { name: 'React', category: 'Framework' },
            { name: 'Angular', category: 'Framework' },
            { name: 'Vue.js', category: 'Framework' },
            { name: 'Next.js', category: 'Framework' },
            { name: 'Node.js', category: 'Framework' },
            { name: 'Express', category: 'Framework' },
            { name: 'Django', category: 'Framework' },
            { name: 'Laravel', category: 'Framework' },
            { name: 'Docker', category: 'Cloud/DevOps' },
            { name: 'Kubernetes', category: 'Cloud/DevOps' },
            { name: 'AWS', category: 'Cloud/DevOps' },
            { name: 'Azure', category: 'Cloud/DevOps' },
            { name: 'GCP', category: 'Cloud/DevOps' },
            { name: 'CI/CD', category: 'Cloud/DevOps' }
        ];

        for (const skill of skills) {
            await Skill.findOneAndUpdate(
                { name: skill.name },
                skill,
                { upsert: true, new: true }
            );
        }

        console.log('Skills seeded successfully!');
        process.exit();
    } catch (error) {
        console.error('Error seeding skills:', error);
        process.exit(1);
    }
};

seedSkills();
