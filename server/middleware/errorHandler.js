const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);

  // Default error
  let error = {
    message: err.message || 'Internal Server Error',
    status: err.status || 500
  };

  // Firebase errors
  if (err.code && err.code.startsWith('auth/')) {
    error.status = 401;
    error.message = 'Authentication failed';
  }

  // Firestore errors
  if (err.code && err.code.startsWith('permission-denied')) {
    error.status = 403;
    error.message = 'Permission denied';
  }

  // Validation errors
  if (err.isJoi) {
    error.status = 400;
    error.message = err.details[0].message;
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production') {
    if (error.status === 500) {
      error.message = 'Internal Server Error';
    }
  }

  res.status(error.status).json({
    error: error.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
};

module.exports = { errorHandler };
