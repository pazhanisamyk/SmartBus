import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import Bus from './models/Bus.js';
import User from './models/User.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Database Connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_timing')
  .then(async () => {
    console.log('Connected to MongoDB');
    // Initialize admin if not exists
    const adminExists = await User.findOne({ username: 'admin' });
    if (!adminExists) {
      await User.create({ username: 'admin', password: 'admin123' });
      console.log('Default admin created: admin/admin123');
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Routes
// 1. Get all buses or search by query
app.get('/api/buses', async (req, res) => {
  try {
    const { search, from, to } = req.query;
    let query = {};

    if (search) {
      query.$or = [
        { bus_no: { $regex: search, $options: 'i' } },
        { start_place: { $regex: search, $options: 'i' } },
        { end_place: { $regex: search, $options: 'i' } }
      ];
    }

    if (from && to) {
      query.start_place = { $regex: from, $options: 'i' };
      query.end_place = { $regex: to, $options: 'i' };
    }

    const buses = await Bus.find(query).sort({ departure_time: 1 });
    res.json(buses);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. Get bus by ID
app.get('/api/buses/:id', async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ message: 'Bus not found' });
    res.json(bus);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. Create or update bus (Admin)
app.post('/api/buses', async (req, res) => {
  try {
    const bus = new Bus(req.body);
    const newBus = await bus.save();
    res.status(201).json(newBus);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 4. Update bus status (Crowd-sourced/Admin)
app.patch('/api/buses/:id', async (req, res) => {
  try {
    const updatedBus = await Bus.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedBus);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// 5. Delete bus
app.delete('/api/buses/:id', async (req, res) => {
  try {
    const bus = await Bus.findByIdAndDelete(req.params.id);
    if (!bus) return res.status(404).json({ message: 'Bus not found' });
    res.json({ message: 'Bus deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 6. Admin Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username, password });
    if (user) {
      res.json({ success: true, message: 'Login successful' });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 7. Update Password
app.post('/api/auth/update-password', async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;
  try {
    // Verify current password first
    const user = await User.findOne({ username, password: currentPassword });
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid current password' });
    }

    user.password = newPassword;
    await user.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
