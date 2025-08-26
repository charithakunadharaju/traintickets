const express = require("express");
const mongoose = require("mongoose");
const TelegramBot = require("node-telegram-bot-api");
const bodyParser = require("body-parser");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(bodyParser.json());

const TELEGRAM_TOKEN = "XXXXXXXXX";  //Replace the token 

// MongoDB Connection
mongoose.connect("mongodb://localhost:27017/trainDB")
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.error(" MongoDB connection error:", err));

// Schemas
const trainSchema = new mongoose.Schema({
  trainNumber: String,
  date: String,
  boardingStation: String,
  destination: String,
  trainClass: String,
  availableTickets: Number,
});
const bookingSchema = new mongoose.Schema({
  ticketId: String,
  trainNumber: String,
  date: String,
  boardingStation: String,
  destination: String,
  trainClass: String,
  numberOfTickets: Number,
});
const postingSchema = new mongoose.Schema({
  postId: String,
  trainNumber: String,
  date: String,
  boardingStation: String,
  destination: String,
  trainClass: String,
  numberOfTickets: Number,
});
const Train = mongoose.model("Train", trainSchema);
const Booking = mongoose.model("Booking", bookingSchema);
const Posting = mongoose.model("Posting", postingSchema);

// User state for conversations
const userContext = {};
const allowedClasses = ["Sleeper", "3A", "2A", "1A"];

function resetState(userId) {
  delete userContext[userId];
}

//find train with exact match
async function findTrainExact(data) {
  return await Train.findOne({
    trainNumber: data.trainNumber,
    date: data.date,
    boardingStation: data.boardingStation,
    destination: data.destination,
    trainClass: data.trainClass,
  });
}

// Conversation handler
async function handleMessage(userId, msg) {
  if (!userContext[userId]) {
    if (msg.toLowerCase() === "hi") {
      userContext[userId] = { stage: "action" };
      return 'What would you like to do? (Buy / Post / Check / Delete Booking / Delete Posting)';
    }
    return 'Please say "hi" to start.';
  }

  const state = userContext[userId];

  // Action selection
  if (state.stage === "action") {
    if (msg.toLowerCase() === "buy") {
      state.action = "buy";
      state.stage = "await_train_number";
      state.data = {};
      return "Enter train number:";
    }
    if (msg.toLowerCase() === "post") {
      state.action = "post";
      state.stage = "await_train_number";
      state.data = {};
      return "Enter train number:";
    }
    if (msg.toLowerCase() === "check") {
      state.action = "check";
      state.stage = "await_train_number";
      state.data = {};
      return "Enter train number:";
    }
    if (msg.toLowerCase() === "delete booking") {
      state.action = "delete_booking";
      state.stage = "await_id";
      return "Enter Booking ID to delete:";
    }
    if (msg.toLowerCase() === "delete posting") {
      state.action = "delete_posting";
      state.stage = "await_id";
      return "Enter Posting ID to delete:";
    }
    return "Invalid choice. Choose Buy / Post / Check / Delete Booking / Delete Posting.";
  }

  // Delete Booking
  if (state.action === "delete_booking" && state.stage === "await_id") {
    const deleted = await Booking.findOneAndDelete({ ticketId: msg });
    resetState(userId);
    return deleted
      ? `Booking with Ticket ID ${msg} deleted successfully.`
      : "Booking not found.";
  }

  // Delete Posting
  if (state.action === "delete_posting" && state.stage === "await_id") {
    const deleted = await Posting.findOneAndDelete({ postId: msg });
    resetState(userId);
    return deleted
      ? `Posting with Post ID ${msg} deleted successfully.`
      : "Posting not found.";
  }

  // Buy / Post / Check flow
  if (["buy", "post", "check"].includes(state.action)) {
    if (state.stage === "await_train_number") {
      state.data.trainNumber = msg;
      state.stage = "await_date";
      return "Enter date (YYYY-MM-DD):";
    }

    if (state.stage === "await_date") {
      state.data.date = msg;
      state.stage = "await_boarding";
      return "Enter boarding station:";
    }

    if (state.stage === "await_boarding") {
      state.data.boardingStation = msg;
      state.stage = "await_destination";
      return "Enter destination station:";
    }

    if (state.stage === "await_destination") {
      state.data.destination = msg;
      state.stage = "await_class";
      return "Choose train class: Sleeper / 3A / 2A / 1A";
    }

    if (state.stage === "await_class") {
      if (!allowedClasses.includes(msg)) {
        return "Invalid class. Choose Sleeper, 3A, 2A, or 1A";
      }
      state.data.trainClass = msg;
      state.stage = "await_tickets";
      return "Enter number of tickets:";
    }

    if (state.stage === "await_tickets") {
      const num = parseInt(msg);
      if (isNaN(num) || num <= 0) {
        return "Please enter a valid ticket count.";
      }
      state.data.numberOfTickets = num;

      if (state.action === "buy") {
        const train = await findTrainExact(state.data);
        if (!train || train.availableTickets < num) {
          resetState(userId);
          return "Train not available or not enough tickets. Say 'hi' to start again.";
        }
        train.availableTickets -= num;
        await train.save();
        const ticketId = uuidv4();
        await Booking.create({ ...state.data, ticketId });
        resetState(userId);
        return `Booking successful! Ticket ID: ${ticketId}`;
      }

      if (state.action === "post") {
        const postId = uuidv4();

        await Posting.create({ ...state.data, postId });

        // Create or update Train
        let train = await findTrainExact(state.data);
        if (!train) {
          train = new Train({
            trainNumber: state.data.trainNumber,
            date: state.data.date,
            boardingStation: state.data.boardingStation,
            destination: state.data.destination,
            trainClass: state.data.trainClass,
            availableTickets: num,
          });
        } else {
          train.availableTickets += num;
        }
        await train.save();

        resetState(userId);
        return `Posting successful! Post ID: ${postId}`;
      }

      if (state.action === "check") {
        const train = await findTrainExact(state.data);
        resetState(userId);
        if (!train) return "Train not found.";
        return `Train ${train.trainNumber} on ${train.date} has ${train.availableTickets} tickets available in ${train.trainClass}.`;
      }
    }
  }

  return 'Please say "hi" to start a new conversation.';
}

// chat endpoint
app.post("/chat", async (req, res) => {
  const userId = "postman"; // fixed userId for Postman
  const msg = req.body.message;
  const reply = await handleMessage(userId, msg);
  res.json({ reply });
});

// Telegram Bot
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });
bot.on("message", async (msg) => {
  const userId = msg.chat.id.toString();
  const reply = await handleMessage(userId, msg.text);
  bot.sendMessage(msg.chat.id, reply);
});

// Start server
app.listen(3000, () => console.log("Server running on port 3000"));
     