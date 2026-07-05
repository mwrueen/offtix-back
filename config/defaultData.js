const User = require('../models/User');
const Currency = require('../models/Currency');

const defaultCurrencies = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee' },
  { code: 'LKR', symbol: '₨', name: 'Sri Lankan Rupee' },
  { code: 'QAR', symbol: 'ر.ق', name: 'Qatari Riyal' },
  { code: 'OMR', symbol: 'ر.ع.', name: 'Omani Rial' },
  { code: 'BHD', symbol: '.د.ب', name: 'Bahraini Dinar' },
  { code: 'KWD', symbol: 'د.ك', name: 'Kuwaiti Dinar' }
];

const createDefaultData = async () => {
  try {
    // Create admin accounts
    await createAdminAccounts();

    // Seed currencies
    await seedCurrencies();

    console.log('Default data initialization completed');
  } catch (error) {
    console.error('Error creating default data:', error);
  }
};

const seedCurrencies = async () => {
  for (const curr of defaultCurrencies) {
    const exists = await Currency.findOne({ code: curr.code });
    if (!exists) {
      await Currency.create(curr);
      console.log(`Seeded currency: ${curr.code}`);
    }
  }
};

const createAdminAccounts = async () => {
  const adminExists = await User.findOne({ email: 'admin@offtix.com' });
  if (!adminExists) {
    await User.create({
      name: 'Admin User',
      email: 'admin@offtix.com',
      password: 'admin123',
      role: 'admin'
    });
    console.log('Admin account created: admin@offtix.com / admin123');
  }

  const superAdminExists = await User.findOne({ email: 'superadmin@offtix.com' });
  if (!superAdminExists) {
    await User.create({
      name: 'Super Admin',
      email: 'superadmin@offtix.com',
      password: 'superadmin123',
      role: 'superadmin'
    });
    console.log('Super Admin account created: superadmin@offtix.com / superadmin123');
  }
};

module.exports = { createDefaultData };