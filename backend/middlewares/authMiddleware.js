const jwt = require("jsonwebtoken");
const config = require("../config/config");

const verifyJWT = (req, res, next) => {
  try {
    // Check for authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized: No token" });
    }

    // Get token
    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = jwt.verify(token, config.auth.jwtSecret);

    // Attach user info to request object
    req.user = decoded;

    // Continue to next middleware/route
    next();
  } catch (err) {
    console.error(err);
    res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};

module.exports = verifyJWT;