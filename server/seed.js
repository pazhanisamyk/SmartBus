import mongoose from 'mongoose';
import Bus from './models/Bus.js';
import dotenv from 'dotenv';

dotenv.config();

const sampleBuses = [
  {
    bus_no: "20A",
    route_no: "2",
    bus_name: "TNSTC Ordinary",
    start_place: "Panruti Bus Stand",
    end_place: "Kurinjipadi Bus Stand",
    arrival_time: "08:45 AM",
    stand_time: {
      from: "08:45 AM",
      to: "09:00 AM"
    },
    departure_time: "09:00 AM",
    route_stops: [
      "Kadampuliyur",
      "Samuthuvapuram",
      "Azhagappasamuthiram",
      "Chathiram",
      "Vengadampettai",
      "Kurinjipadi"
    ],
    end_time: "10:00 AM",
    platform: "3",
    travel_time: "1 hour 15 mins",
    distance: "25 km",
    full_schedule: [
      { trip_no: 1, from: "Panruti", to: "Kurinjipadi", departure: "06:00 AM", arrival: "07:15 AM" },
      { trip_no: 2, from: "Kurinjipadi", to: "Panruti", departure: "07:25 AM", arrival: "08:40 AM" },
      { trip_no: 3, from: "Panruti", to: "Kurinjipadi", departure: "08:50 AM", arrival: "10:05 AM" },
      { trip_no: 4, from: "Kurinjipadi", to: "Panruti", departure: "10:15 AM", arrival: "11:30 AM" },
      { trip_no: 5, from: "Rest & Lunch", to: "Break", departure: "11:30 AM", arrival: "01:00 PM", is_break: true, note: "Lunch Break" },
      { trip_no: 6, from: "Panruti", to: "Kurinjipadi", departure: "01:10 PM", arrival: "02:25 PM" },
      { trip_no: 7, from: "Kurinjipadi", to: "Panruti", departure: "02:35 PM", arrival: "03:50 PM" }
    ]
  },
  {
    bus_no: "15C",
    route_no: "5",
    bus_name: "TNSTC Express",
    start_place: "Panruti Bus Stand",
    end_place: "Neyveli T.S",
    arrival_time: "09:15 AM",
    stand_time: {
      from: "09:15 AM",
      to: "09:30 AM"
    },
    departure_time: "09:30 AM",
    route_stops: [
      "Vadalur",
      "Neyveli Arch",
      "Neyveli T.S"
    ],
    end_time: "10:15 AM",
    platform: "5",
    travel_time: "45 mins",
    distance: "18 km"
  }
];

const seedDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bus_timing');
    console.log('Connected to MongoDB for seeding...');
    
    await Bus.deleteMany({});
    console.log('Deleted existing buses');
    
    await Bus.insertMany(sampleBuses);
    console.log('Inserted sample buses');
    
    process.exit();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

seedDB();
