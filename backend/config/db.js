const mongoose = require('mongoose');

// Robust connect with retries and connection event logging to handle
// transient network errors (e.g. ECONNRESET) more gracefully.
const connectWithRetry = async (retries = 5, delay = 2000) => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      // Keep a reasonable pool size; tune if needed for high traffic
      maxPoolSize: 10,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error(
      '❌ MongoDB connection error:',
      error && error.message ? error.message : error,
    );
    if (retries > 0) {
      console.log(
        `🔁 Retrying MongoDB connection in ${delay}ms (${retries} attempts left)`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
      return connectWithRetry(retries - 1, Math.min(delay * 2, 30000));
    }
    console.error('❌ Exhausted MongoDB connection retries. Exiting.');
    process.exit(1);
  }
};

// Attach helpful connection event listeners
mongoose.connection.on('connected', () => {
  console.log(
    '🔌 Mongoose connected to',
    process.env.MONGODB_URI ? 'MongoDB' : 'unknown host',
  );
});

mongoose.connection.on('error', (err) => {
  console.error(
    '⚠️ Mongoose connection error:',
    err && err.message ? err.message : err,
  );
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ Mongoose disconnected. Attempting reconnect...');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  try {
    await mongoose.connection.close();
    console.log('🛑 Mongoose connection closed through app termination');
    process.exit(0);
  } catch (err) {
    console.error('Error during mongoose disconnect on SIGINT', err);
    process.exit(1);
  }
});

module.exports = connectWithRetry;
