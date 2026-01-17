const Room = require('../models/Room');

exports.getAllRooms = async (req, res) => {
  try {
    // Fetch rooms
    const rooms = await Room.find({}, "name users");

    // Map rooms to include user count
    const roomsWithCount = rooms.map(room => ({
      id: room._id,
      name: room.name,
      userCount: room.users.length,
    }));

    res.status(200).json({ rooms: roomsWithCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};


exports.addRoom = async (req, res) => {
     try {
        const { newRoomName } = req.body;

        // Validate input
        if (!newRoomName) {
            return res.status(400).json({ message: "Room name is required" });
        }

        // Check if room name already exists
        const existingRoom = await Room.findOne({ name: newRoomName });
        if (existingRoom) {
            return res.status(409).json({ message: "Room name already exists" });
        }

        // Create and save the new room
        const newRoom = new Room({ name: newRoomName });
        await newRoom.save();

        res.status(201).json({ message: "Room created successfully", id: newRoom._id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
}

exports.deleteRoom = async (req, res) => {
    try {
        const roomID = req.params.id;

        // Validate input
        if (!roomID) {
            return res.status(400).json({ message: "Room ID is required" });
        }

        // Check if room exists
        const room = await Room.findById(roomID);
        if (!room) {
            return res.status(404).json({ message: "Room not found" });
        }

        // Delete the room
        await Room.findByIdAndDelete(roomID);

        res.status(200).json({ message: "Room deleted successfully" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
}

exports.getRoomMembers = async (req, res) => {
    try {
    const roomId = req.params.id;
    const room = await Room.findById(roomId).populate("users", "name"); 

    if (!room) {
      return res.status(404).json({ message: "Room not found" });
    }

    // Extract the user names
    const userNames = room.users.map(user => user.name);

    return res.status(200).json({ members: userNames });
  } catch (err) {
    console.error("Error fetching user names:", err);
    throw err;
  }
}