const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  const statusCode = err.statusCode || (err.name === 'MulterError' ? 400 : 500);
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Server error',
  });
};

module.exports = errorHandler;
