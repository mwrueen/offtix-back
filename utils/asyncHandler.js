/**
 * Wraps an async Express handler so any rejected promise is forwarded to the
 * centralized error-handling middleware via next(err), removing the need for
 * repetitive try/catch blocks in every controller.
 *
 * @param {Function} fn async (req, res, next) => {...}
 * @returns {Function} Express middleware
 */
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
