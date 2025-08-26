# Train Ticket Booking & Posting Bot

A conversational train ticket system built with **Node.js, Express, MongoDB, and Telegram Bot API**.  
Users can **Buy, Post, Check, and Delete** train ticket bookings or postings via Telegram or REST API.

## Features
- Buy tickets with unique **Booking IDs**.
- Post spare tickets with **Post IDs**.
- Check ticket availability by train/date/class.
- Delete bookings or postings.
- User conversation state handling for step-by-step interactions.
- REST API endpoint (`/chat`) for testing with Postman.

## Tech Stack
- Node.js (Express)
- MongoDB + Mongoose
- Telegram Bot API (node-telegram-bot-api)
- REST API (JSON)

## Endpoints
- `POST /chat` → `{ "message": "hi" }`

## ▶Run Locally
```bash
git clone https://github.com/charithakunadharaju/traintickets.git
cd traintickets
npm install
node app.js
