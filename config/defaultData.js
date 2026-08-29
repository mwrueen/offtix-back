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
  const accounts = [
    { name: 'Super Admin', email: 'admin@offtix.com', password: 'password123', role: 'superadmin' },
    { name: 'Super Admin System', email: 'superadmin@offtix.com', password: 'password123', role: 'superadmin' },
    { name: 'Demo Client', email: 'client@offtix.com', password: 'password123', role: 'admin' },
    { name: 'Demo User', email: 'user@offtix.com', password: 'password123', role: 'user' }
  ];

  for (const acc of accounts) {
    const exists = await User.findOne({ email: acc.email });
    if (!exists) {
      await User.create(acc);
      console.log(`Created account: ${acc.email} / ${acc.password} (${acc.role})`);
    }
  }
};


module.exports = { createDefaultData };