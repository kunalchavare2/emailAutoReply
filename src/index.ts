// src/index.ts
import express, { Express } from 'express';
import dotenv from 'dotenv';
import { createServer } from 'node:http';

import cors from 'cors';

const CorsConfig = {
  origin: [
    'http://localhost:4000',
    'https://amedeloitte.sharepoint.com',
    'https://admin.socket.io',
    'https://iaboardgame.deloitte.com/',
  ],
  methods: ['GET', 'POST'], // Specify allowed methods (GET, POST, etc.)
  allowedHeaders: ['Content-Type'], // Specify allowed headers
  credentials: true, // If you need to send cookies or other credentials
};

dotenv.config();

const app: Express = express();
app.use(cors(CorsConfig));
const server = createServer(app);
const port = process.env.PORT || 3000;

/* Start the Express app and listen
 for incoming requests on the specified port */
server.listen(port, async () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});

// Define a home route
app.get('/', (req, res) => {
  res.send('Welcome to the IA Gameboard WebSocket Server!');
});
