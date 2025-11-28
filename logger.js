const winston = require('winston');
require('winston-daily-rotate-file');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `[${timestamp}] ${level.toUpperCase()}: ${message}`;
  })
);

// Create the logger
const logger = winston.createLogger({
  level: 'info', // Minimum level to log
  format: logFormat,
  transports: [
    // 1. Write all logs to console (useful for dev)
    new winston.transports.Console(),

    // 2. Write all logs to a daily rotating file
    new winston.transports.DailyRotateFile({
      filename: 'logs/application-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true, // Compress old logs to save space
      maxSize: '20m',      // Rotate if file size exceeds 20MB
      maxFiles: '14d'      // Keep logs for 14 days, then delete
    }),

    // 3. Separate file specifically for Errors (easier debugging)
    new winston.transports.DailyRotateFile({
      filename: 'logs/error-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      level: 'error',      // Only log 'error' level here
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d'
    })
  ]
});

module.exports = logger;