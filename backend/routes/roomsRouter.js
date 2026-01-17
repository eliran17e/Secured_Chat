const express = require("express");
const router = express.Router();
const roomsController = require("../controllers/roomsController");
const verifyJWT = require("../middlewares/authMiddleware");

// Routes
router.get("/", verifyJWT, roomsController.getAllRooms);
router.post("/add", verifyJWT, roomsController.addRoom);
router.delete("/:id",verifyJWT, roomsController.deleteRoom);
router.get("/:id", verifyJWT, roomsController.getRoomMembers);

module.exports = router;
