const { validationResult } = require('express-validator');

/**
 * Reusable middleware that collects the results of express-validator chains.
 * Responds with the existing `{ errors: [...] }` contract (HTTP 400) when the
 * request is invalid, otherwise hands off to the next handler. Lets controllers
 * stay free of repetitive validationResult() boilerplate.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

module.exports = validate;
