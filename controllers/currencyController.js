const Currency = require('../models/Currency');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');

// Get all currencies
exports.getCurrencies = asyncHandler(async (req, res) => {
  const currencies = await Currency.find().sort({ code: 1 });
  res.json(currencies);
});

// Create a new currency
exports.createCurrency = asyncHandler(async (req, res) => {
  const { code, symbol, name } = req.body;
  if (!code || !symbol || !name) {
    throw ApiError.badRequest('Code, symbol, and name are required');
  }

  const normalizedCode = code.toUpperCase().trim();
  const exists = await Currency.findOne({ code: normalizedCode });
  if (exists) {
    throw ApiError.badRequest(`Currency with code ${normalizedCode} already exists`);
  }

  const currency = await Currency.create({
    code: normalizedCode,
    symbol: symbol.trim(),
    name: name.trim(),
    icon: ''
  });

  res.status(201).json(currency);
});

// Update a currency
exports.updateCurrency = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { code, symbol, name } = req.body;

  const currency = await Currency.findById(id);
  if (!currency) {
    throw ApiError.notFound('Currency not found');
  }

  if (code) {
    const normalizedCode = code.toUpperCase().trim();
    if (normalizedCode !== currency.code) {
      const exists = await Currency.findOne({ code: normalizedCode });
      if (exists) {
        throw ApiError.badRequest(`Currency with code ${normalizedCode} already exists`);
      }
      currency.code = normalizedCode;
    }
  }

  if (symbol) currency.symbol = symbol.trim();
  if (name) currency.name = name.trim();

  await currency.save();
  res.json(currency);
});

// Delete a currency
exports.deleteCurrency = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const currency = await Currency.findById(id);
  if (!currency) {
    throw ApiError.notFound('Currency not found');
  }

  await Currency.findByIdAndDelete(id);
  res.json({ message: 'Currency deleted successfully' });
});

// Upload currency icon
exports.uploadIcon = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!req.file) {
    throw ApiError.badRequest('Please upload an image file');
  }

  const currency = await Currency.findById(id);
  if (!currency) {
    throw ApiError.notFound('Currency not found');
  }

  // File path format compatible with other models (e.g. uploads/currency-icons/...)
  const iconPath = req.file.path ? req.file.path.replace(/\\/g, '/') : `uploads/currency-icons/${req.file.filename}`;
  currency.icon = iconPath;
  await currency.save();

  res.json(currency);
});
