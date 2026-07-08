import mongoose from 'mongoose';

const busSchema = new mongoose.Schema({
  bus_no: { type: String, required: true },
  route_no: { type: String },
  bus_name: { type: String, required: true },
  start_place: { type: String, required: true },
  end_place: { type: String, required: true },
  arrival_time: { type: String },
  stand_time: {
    from: { type: String },
    to: { type: String }
  },
  departure_time: { type: String },
  route_stops: [{ type: String }],
  end_time: { type: String },
  platform: { type: String },
  travel_time: { type: String },
  distance: { type: String },
  segment_distance: { type: Number, default: 6.5 },
  base_fare: { type: Number, default: 10 },
  price_per_km: { type: Number, default: 0.78 },
  full_schedule: [{
    trip_no: Number,
    from: String,
    to: String,
    departure: String,
    arrival: String,
    is_break: { type: Boolean, default: false },
    note: String
  }],
  crowd_report: {
    status: { type: String },
    time: { type: Date }
  },
  last_updated: { type: Date, default: Date.now }
}, { timestamps: true });

const Bus = mongoose.model('Bus', busSchema);
export default Bus;
