const ApiError = require('../utils/ApiError');

/**
 * 404 handler for unmatched API routes. Mounted on the `/api` path so that
 * unknown endpoints return a JSON error instead of falling through to the
 * React catch-all / Express default HTML page.
 */
const notFound = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.method} ${req.originalUrl}`));
};

/**
 * Centralized error-handling middleware. Normalizes common Mongoose / JWT
 * errors and serializes everything to the existing `{ error: message }`
 * contract (with optional `errors` array for validation details).
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Invalid Mongo ObjectId / cast failure
  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Duplicate unique key
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = field ? `Duplicate value for field: ${field}` : 'Duplicate key error';
  }

  // Mongoose schema validation
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map((e) => e.message).join(', ');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token.';
  }
  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired.';
  }

  // Log server-side faults for diagnostics
  if (statusCode >= 500) {
    console.error(err);
  }

  const body = { error: message };
  if (err.details) {
    body.errors = err.details;
  }
  // If the error explicitly carries its own response body (e.g., legacy shapes
  // with extra keys such as `tasksCount`), merge those keys in. This allows
  // preserving old API contracts while still using the service layer.
  if (err.body && typeof err.body === 'object') {
    Object.assign(body, err.body);
  }

  res.status(statusCode).json(body);
};

module.exports = { notFound, errorHandler };
