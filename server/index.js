// server/index.js
const express = require('express');
const cors = require('cors');
const { expressjwt: jwtMiddleware } = require('express-jwt');
const authRouter = require('./routes/auth');
const roomsRouter = require('./routes/rooms');
const itemsRouter = require('./routes/items');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Public health check
app.get('/ping', (req, res) => res.send('pong'));

// 1. Public auth routes (signup & login)
app.use('/api/auth', authRouter);

// 2. JWT middleware for protected routes
app.use(
  jwtMiddleware({
    secret: process.env.JWT_SECRET || 'supersecret',
    algorithms: ['HS256'],
  }).unless({
    path: ['/api/auth/signup', '/api/auth/login', '/ping'],
  })
);

// 3. Protected API routes (rooms & items)
app.use('/api/rooms', roomsRouter);
app.use('/api/items', itemsRouter);

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
