const mongoose = require("mongoose");
const config = require("./config/config");

const connectDB = async () => {
  try {
    await mongoose.connect(config.database.mongoUri, config.database.options);
    console.log("MongoDB connected successfully");
    console.log(`Database: ${config.database.mongoUri.split('/').pop()}`);
  } catch (err) {
    console.error("MongoDB connection error:", err.message);
    process.exit(1); // Exit on failure
  }
};

module.exports = connectDB;
