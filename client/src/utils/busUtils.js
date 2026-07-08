export const parseTime = (timeStr) => {
  if (!timeStr) return 0;
  // Handle "HH:mm AM/PM" or "HH:mm"
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return 0;
  
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const ampm = match[3] ? match[3].toUpperCase() : null;

  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
};

export const getCurrentTrip = (schedule) => {
  if (!schedule || schedule.length === 0) return null;

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Sort schedule by departure time just in case
  const sortedSchedule = [...schedule].sort((a, b) => parseTime(a.departure) - parseTime(b.departure));

  for (let i = 0; i < sortedSchedule.length; i++) {
    const trip = sortedSchedule[i];
    const depMins = parseTime(trip.departure);
    const arrMins = parseTime(trip.arrival);

    // Current Trip: Between departure and arrival
    if (currentMinutes >= depMins && currentMinutes < arrMins) {
      return { ...trip, status: trip.is_break ? 'BREAK' : 'ON_TRIP' };
    }

    // Between trips (at arrival of current and departure of next)
    if (i < sortedSchedule.length - 1) {
      const nextTrip = sortedSchedule[i + 1];
      const nextDepMins = parseTime(nextTrip.departure);
      if (currentMinutes >= arrMins && currentMinutes < nextDepMins) {
        return { ...nextTrip, status: 'DP_WAITING' }; // Waiting at 'from' place of next trip
      }
    }
  }

  // Check if before first trip
  const firstDep = parseTime(sortedSchedule[0].departure);
  if (currentMinutes < firstDep) {
    return { ...sortedSchedule[0], status: 'UPCOMING' };
  }

  // If after last trip
  const lastArr = parseTime(sortedSchedule[sortedSchedule.length - 1].arrival);
  if (currentMinutes >= lastArr) {
    return { status: 'COMPLETED' };
  }

  return null;
};
