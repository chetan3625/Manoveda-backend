const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const { PORT } = require('./config/constants');
const { errorHandler, notFound } = require('./middleware/error');
const { initializeSocket } = require('./socket/socket');
const {
  authRoutes,
  adminRoutes,
  doctorRoutes,
  patientRoutes,
  medicalKeeperRoutes,
  chatRoutes,
  paymentRoutes
} = require('./routes');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Manoveda API Server',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      admin: '/api/admin',
      doctor: '/api/doctor',
      patient: '/api/patient',
      medicalKeeper: '/api/medical-keeper',
      chat: '/api/chat',
      payment: '/api/payment'
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/medical-keeper', medicalKeeperRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/payment', paymentRoutes);

app.use(notFound);
app.use(errorHandler);

initializeSocket(io);

const startServer = async () => {
  try {
    await connectDB();

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log('Socket.io initialized');
    });
  } catch (error) {
    console.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

startServer();
