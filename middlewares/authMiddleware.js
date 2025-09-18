const jwt = require("jsonwebtoken");
const secretKey = "apjabdulkalam@545";

function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer "))
    return res.json({ message: "token required" });

  const token = authHeader.split(" ")[1];
  jwt.verify(token, secretKey, (error, decode) => {
    if (error) {
      return res.send({ message: "invalid token" });
    }
    req.user = decode;
    next();
  });
}

module.exports = verifyToken;
