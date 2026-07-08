import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { busApi } from '../services/api';
import { ArrowLeft, MapPin, Clock, Info, Shield, Share2, Navigation, AlertCircle, MessageSquare, AlertTriangle, CheckCircle, X, Bell, Banknote } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { getCurrentTrip, parseTime } from '../utils/busUtils';

const activeReminders = {};
const getJourneyDetails = (bus, boardStop, alightStop) => {
  if (!bus || !boardStop || !alightStop || boardStop === alightStop) return null;
  
  const stopsList = bus.route_stops || [];
  
  const parsedStops = stopsList.map(stopStr => {
    const match = stopStr.match(/(.+?)\s*\(\s*([0-9.]+)\s*\)/);
    if (match) {
      return { name: match[1].trim(), km: parseFloat(match[2]), raw: stopStr };
    }
    return { name: stopStr.trim(), km: null, raw: stopStr };
  });
  
  const boardObj = parsedStops.find(s => s.raw === boardStop || s.name === boardStop);
  const alightObj = parsedStops.find(s => s.raw === alightStop || s.name === alightStop);
  
  if (!boardObj || !alightObj) return null;
  
  const boardIdx = parsedStops.indexOf(boardObj);
  const alightIdx = parsedStops.indexOf(alightObj);
  
  let distanceVal = 0;
  if (boardObj.km !== null && alightObj.km !== null) {
    distanceVal = Number(Math.abs(alightObj.km - boardObj.km).toFixed(1));
  } else {
    const numSegments = Math.abs(alightIdx - boardIdx);
    const segmentDist = bus.segment_distance !== undefined && bus.segment_distance !== null ? bus.segment_distance : 6.5;
    distanceVal = Number((numSegments * segmentDist).toFixed(1));
  }
  
  const isExpress = bus.bus_name?.toLowerCase().includes('express') || bus.bus_name?.toLowerCase().includes('deluxe') || bus.bus_name?.toLowerCase().includes('bypass');
  const baseFare = bus.base_fare !== undefined && bus.base_fare !== null ? bus.base_fare : (isExpress ? 15 : 10);
  const pricePerKm = bus.price_per_km !== undefined && bus.price_per_km !== null ? bus.price_per_km : (isExpress ? 1.25 : 0.78);
  const fareVal = Math.round(baseFare + distanceVal * pricePerKm);
  
  const numSegments = Math.abs(alightIdx - boardIdx);
  const durationVal = numSegments * 12;
  
  return {
    distance: distanceVal,
    duration: durationVal,
    fare: fareVal,
    isExpress,
    baseFare,
    pricePerKm
  };
};

const getApproxRouteFare = (bus) => {
  if (!bus || !bus.distance) return '';
  const parsedDist = parseInt(bus.distance);
  if (isNaN(parsedDist)) return '';
  const isExpress = bus.bus_name?.toLowerCase().includes('express') || bus.bus_name?.toLowerCase().includes('deluxe') || bus.bus_name?.toLowerCase().includes('bypass');
  const baseFare = bus.base_fare !== undefined && bus.base_fare !== null ? bus.base_fare : (isExpress ? 15 : 10);
  const pricePerKm = bus.price_per_km !== undefined && bus.price_per_km !== null ? bus.price_per_km : (isExpress ? 1.25 : 0.78);
  const fareVal = Math.round(baseFare + parsedDist * pricePerKm);
  return `(₹${fareVal})`;
};

const BusDetails = () => {
  const { t } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();
  const [bus, setBus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentTrip, setCurrentTrip] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [boardStop, setBoardStop] = useState('');
  const [alightStop, setAlightStop] = useState('');
  const [ticketGenerated, setTicketGenerated] = useState(false);
  const [ticketNo, setTicketNo] = useState('');
  const [passengerName, setPassengerName] = useState('Commuter Express');
  const [selectedSeat, setSelectedSeat] = useState(null);

  useEffect(() => {
    if (bus?.route_stops && bus.route_stops.length > 1) {
      setBoardStop(bus.route_stops[0]);
      setAlightStop(bus.route_stops[bus.route_stops.length - 1]);
      setTicketGenerated(false);
      setSelectedSeat(null);
    }
  }, [bus]);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type }), 3000);
  };

  const getStatusInfo = (status) => {
    switch (status) {
      case 'ON_TRIP': return { label: t('currently_in_transit'), color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: <Navigation size={18} className="animate-pulse" /> };
      case 'BREAK': return { label: t('on_rest_break'), color: 'text-amber-400', bg: 'bg-amber-500/20', icon: <AlertCircle size={18} /> };
      case 'DP_WAITING': return { label: t('waiting_at_departure'), color: 'text-blue-400', bg: 'bg-blue-500/20', icon: <MapPin size={18} /> };
      case 'UPCOMING': return { label: t('service_starting_soon'), color: 'text-indigo-400', bg: 'bg-indigo-500/20', icon: <Clock size={18} /> };
      case 'COMPLETED': return { label: t('service_ended'), color: 'text-slate-400', bg: 'bg-slate-500/10', icon: <Info size={18} /> };
      default: return null;
    }
  };

  useEffect(() => {
    const fetchBus = async () => {
      try {
        const res = await busApi.getById(id);
        setBus(res.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchBus();
  }, [id]);

  useEffect(() => {
    if (!bus?.full_schedule) return;

    setCurrentTrip(getCurrentTrip(bus.full_schedule));

    const interval = setInterval(() => {
      setCurrentTrip(getCurrentTrip(bus.full_schedule));
    }, 1000);

    return () => clearInterval(interval);
  }, [bus?.full_schedule]);

  const submitReport = async (status) => {
    setReportSubmitting(true);
    try {
      const res = await busApi.update(id, {
        crowd_report: status ? { status, time: new Date() } : null
      });
      setBus(res.data);
      setShowReportModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setReportSubmitting(false);
    }
  };

  const isReportRecent = bus?.crowd_report?.time && (new Date() - new Date(bus.crowd_report.time)) < 2 * 60 * 60 * 1000;

  const handleShare = async () => {
    const shareData = {
      title: `${bus.bus_no} - ${bus.bus_name}`,
      text: `Track TNSTC Bus ${bus.bus_no} from ${bus.start_place} to ${bus.end_place}!`,
      url: window.location.href
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(window.location.href);
        showToast(t('link_copied') || 'Link copied to clipboard!');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const handleSetReminder = () => {
    const setupReminderTimer = () => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      let nextDepartureTime = null;
      let nextTripFrom = '';
      let nextTripTo = '';

      if (bus?.full_schedule && bus.full_schedule.length > 0) {
        const futureTrips = bus.full_schedule
          .filter(t => !t.is_break)
          .map(t => ({ ...t, mins: parseTime(t.departure) }))
          .filter(t => t.mins > currentMinutes)
          .sort((a, b) => a.mins - b.mins);

        if (futureTrips.length > 0) {
          nextDepartureTime = futureTrips[0].departure;
          nextTripFrom = futureTrips[0].from;
          nextTripTo = futureTrips[0].to;
        }
      }

      // If no upcoming trip today, find the first trip of tomorrow
      let isTomorrow = false;
      if (!nextDepartureTime && bus?.full_schedule && bus.full_schedule.length > 0) {
        const firstTrip = [...bus.full_schedule]
          .filter(t => !t.is_break)
          .sort((a, b) => parseTime(a.departure) - parseTime(b.departure))[0];

        if (firstTrip) {
          nextDepartureTime = firstTrip.departure;
          nextTripFrom = firstTrip.from;
          nextTripTo = firstTrip.to;
          isTomorrow = true;
        }
      }

      if (nextDepartureTime) {
        const depMins = parseTime(nextDepartureTime);
        let totalDelayMinutes = depMins - currentMinutes;
        if (isTomorrow) {
          const minutesTillMidnight = (24 * 60) - currentMinutes;
          totalDelayMinutes = minutesTillMidnight + depMins;
        }

        const delayMs = totalDelayMinutes * 60 * 1000 - now.getSeconds() * 1000 - now.getMilliseconds();

        if (delayMs > 0) {
          if (activeReminders[bus._id]) {
            clearTimeout(activeReminders[bus._id]);
          }
          activeReminders[bus._id] = setTimeout(() => {
            if ('Notification' in window && Notification.permission === 'granted') {
              new Notification(`Bus ${bus.bus_no} Departing Soon!`, {
                body: `Bus ${bus.bus_no} is departing from ${t(nextTripFrom)} to ${t(nextTripTo)} at ${nextDepartureTime}.`,
                icon: '/favicon.svg'
              });
            }
            delete activeReminders[bus._id];
          }, delayMs);

          const timeMsg = isTomorrow
            ? `${t('reminder_set')} (Tomorrow at ${nextDepartureTime})`
            : `${t('reminder_set')} (at ${nextDepartureTime})`;
          showToast(timeMsg);
        } else {
          showToast(t('reminder_set') || 'Reminder set successfully!');
        }
      } else {
        showToast(t('reminder_set') || 'Reminder set successfully!');
      }
    };

    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          setupReminderTimer();
        } else {
          showToast('Please enable notifications to use this feature.', 'error');
        }
      });
    } else {
      showToast(t('reminder_set') || 'Reminder set successfully!');
    }
  };

  const statusInfo = currentTrip ? getStatusInfo(currentTrip.status) : null;

  const getSimulatedLivePosition = () => {
    if (!bus || !bus.route_stops || bus.route_stops.length === 0) return null;

    const isReturnTrip = currentTrip?.from && bus.end_place &&
                         currentTrip.from.toLowerCase().includes((bus.end_place.toLowerCase().split(' ')[0] || '').toLowerCase());
    const stops = isReturnTrip ? [...bus.route_stops].reverse() : bus.route_stops;
    
    if (!currentTrip || currentTrip.status !== 'ON_TRIP') {
      return {
        progress: 0,
        activeStopIndex: 0,
        nextStop: stops[1] || stops[0],
        prevStop: stops[0],
        etaMins: 0,
        statusText: currentTrip ? (getStatusInfo(currentTrip.status)?.label || 'Resting') : 'Resting',
        stopsList: stops
      };
    }
    
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const depMins = parseTime(currentTrip.departure);
    const arrMins = parseTime(currentTrip.arrival);
    const duration = arrMins - depMins;
    
    if (duration <= 0) {
      return {
        progress: 0,
        activeStopIndex: 0,
        nextStop: stops[1] || stops[0],
        prevStop: stops[0],
        etaMins: 0,
        statusText: t('in_transit'),
        stopsList: stops
      };
    }
    
    const elapsed = Math.max(0, Math.min(duration, nowMins - depMins));
    const progress = elapsed / duration;
    
    const numStops = stops.length;
    const rawIndex = progress * (numStops - 1);
    const activeStopIndex = Math.floor(rawIndex);
    const nextStopIndex = Math.min(numStops - 1, activeStopIndex + 1);
    
    const segmentProgress = (rawIndex - activeStopIndex);
    const segmentDuration = duration / (numStops - 1);
    const totalMinsLeft = segmentDuration * (1 - segmentProgress);
    const totalSecsLeft = Math.max(0, Math.floor(totalMinsLeft * 60));
    const etaMins = Math.floor(totalSecsLeft / 60);
    const etaSecs = totalSecsLeft % 60;
    const etaString = `${etaMins}m ${etaSecs}s`;
    
    return {
      progress,
      activeStopIndex,
      nextStopIndex,
      nextStop: stops[nextStopIndex],
      prevStop: stops[activeStopIndex],
      etaMins,
      etaString,
      stopsList: stops
    };
  };

  if (loading) return (
    <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    </div>
  );

  if (!bus) return <div className="text-center text-slate-400">{t('bus_not_found')}</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group mb-4"
      >
        <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
        <span className="font-semibold">{t('back_to_search')}</span>
      </button>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card overflow-hidden"
      >
        {/* Header Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <span className="inline-block bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest mb-3 backdrop-blur-sm">
                {t(bus.bus_name)}
              </span>
              <h1 className="text-4xl md:text-5xl font-black text-white">{bus.bus_no}</h1>
              <p className="text-blue-100 text-lg mt-2 font-medium">
                {t(currentTrip && currentTrip.status !== 'COMPLETED' ? currentTrip.from : bus.start_place)} 
                <span className="mx-2 opacity-50">→</span> 
                {t(currentTrip && currentTrip.status !== 'COMPLETED' ? currentTrip.to : bus.end_place)}
              </p>
              
              {statusInfo && (
                <div className={`inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl backdrop-blur-md border border-white/10 ${statusInfo.bg}`}>
                  <span className={statusInfo.color}>{statusInfo.icon}</span>
                  <span className={`text-sm font-bold uppercase tracking-wider ${statusInfo.color}`}>
                    {currentTrip.trip_no ? `${t('trip')} #${currentTrip.trip_no}: ` : ''}{statusInfo.label}
                  </span>
                </div>
              )}

              {isReportRecent && (
                <div className="inline-flex items-center gap-2 mt-4 ml-4 px-4 py-2 rounded-xl backdrop-blur-md border border-yellow-500/20 bg-yellow-500/10">
                  <span className="text-yellow-400"><MessageSquare size={18} /></span>
                  <span className={`text-sm font-bold uppercase tracking-wider text-yellow-400`}>
                    {t('user_report')} {t(bus.crowd_report.status.toLowerCase().replace(' ', '_')) || bus.crowd_report.status} ({Math.floor((new Date() - new Date(bus.crowd_report.time)) / 60000)}m ago)
                  </span>
                </div>
              )}
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl text-center min-w-[140px]">
              <div className="text-blue-200 text-xs font-bold uppercase tracking-widest mb-1">Platform</div>
              <div className="text-4xl font-black text-white">{bus.platform || '--'}</div>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-12">
          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-slate-900/50 p-6 rounded-2xl border border-white/5">
            <div className="flex items-center gap-4 group">
              <div className="p-3 rounded-2xl bg-blue-500/10 text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-all">
                <Clock size={24} />
              </div>
              <div>
                 <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Arrival</div>
                 <div className="text-xl font-bold">{(currentTrip && currentTrip.status !== 'COMPLETED' ? currentTrip.arrival : bus.arrival_time) || '--'}</div>
               </div>
            </div>
            <div className="flex items-center gap-4 group">
              <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-white transition-all">
                <Clock size={24} />
              </div>
              <div>
                 <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">Departure</div>
                 <div className="text-xl font-bold">{(currentTrip && currentTrip.status !== 'COMPLETED' ? currentTrip.departure : bus.departure_time) || '--'}</div>
               </div>
            </div>
            <div className="flex items-center gap-4 group">
              <div className="p-3 rounded-2xl bg-amber-500/10 text-amber-400 group-hover:bg-amber-500 group-hover:text-white transition-all">
                <Info size={24} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('travel_time')}</div>
                <div className="text-xl font-bold">{bus.travel_time || '--'}</div>
              </div>
            </div>
            <div className="flex items-center gap-4 group">
              <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-all">
                <Banknote size={24} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('distance')} / {t('approx_fare')}</div>
                <div className="text-xl font-bold">
                  {bus.distance || '--'} 
                  <span className="text-sm text-slate-400 font-medium ml-1">
                    {getApproxRouteFare(bus)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Route Map/Stops */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <MapPin className="text-blue-500" />
                {t('route_information')}
              </h2>
              <div className="flex items-center gap-4">
                <button onClick={handleSetReminder} className="text-sm font-bold text-emerald-400 flex items-center gap-1 hover:underline bg-emerald-400/10 px-3 py-1.5 rounded-lg">
                  <Bell size={16} /> <span className="hidden md:inline">{t('set_reminder')}</span>
                </button>
                <button onClick={() => setShowReportModal(true)} className="text-sm font-bold text-yellow-400 flex items-center gap-1 hover:underline bg-yellow-400/10 px-3 py-1.5 rounded-lg">
                  <AlertTriangle size={16} /> {t('report_status')}
                </button>
                <button onClick={handleShare} className="text-sm font-bold text-blue-400 flex items-center gap-1 hover:underline">
                  <Share2 size={16} /> {t('share_route')}
                </button>
              </div>
            </div>
            
            <div className="relative pt-10 pb-4 overflow-x-auto scrollbar-hide">
              <div className="flex items-start min-w-max px-4">
              {(() => {
                const isReturnTrip = currentTrip && currentTrip.from && bus.end_place && 
                                     currentTrip.from.toLowerCase().includes(bus.end_place.toLowerCase().split(' ')[0].toLowerCase());
                
                const stopsToDisplay = isReturnTrip ? [...(bus.route_stops || [])].reverse() : (bus.route_stops || []);
                
                // Calculate current active stop based on time
                let activeStopIndex = -1;
                if (currentTrip?.status === 'ON_TRIP' && currentTrip.departure && currentTrip.arrival) {
                  const now = new Date();
                  const nowMins = now.getHours() * 60 + now.getMinutes();
                  const depMins = parseTime(currentTrip.departure);
                  const arrMins = parseTime(currentTrip.arrival);
                  const totalTripMins = arrMins - depMins;
                  const elapsedMins = nowMins - depMins;
                  
                  if (totalTripMins > 0) {
                    const progress = Math.max(0, Math.min(1, elapsedMins / totalTripMins));
                    activeStopIndex = Math.floor(progress * (stopsToDisplay.length - 1));
                  }
                } else if (currentTrip?.status === 'DP_WAITING' || currentTrip?.status === 'UPCOMING') {
                  activeStopIndex = 0;
                }

                return stopsToDisplay.map((stop, index) => (
                  <React.Fragment key={index}>
                    <div className="relative flex flex-col items-center w-56 shrink-0 text-center group z-10">
                      {/* Node */}
                      <div className={`w-6 h-6 rounded-full border-4 border-[#0f172a] flex items-center justify-center transition-all duration-300 shadow-xl ${index === activeStopIndex ? 'bg-blue-500 scale-125' : index < activeStopIndex ? 'bg-emerald-500' : index === stopsToDisplay.length - 1 ? 'bg-emerald-500' : 'bg-slate-600 group-hover:bg-slate-500'}`}>
                        {index === activeStopIndex && (
                          <div className="w-2 h-2 rounded-full bg-white animate-ping"></div>
                        )}
                      </div>
                      {/* Text */}
                      <div className="mt-4">
                        {(() => {
                          const match = stop.match(/(.+?)\s*\(\s*([0-9.]+)\s*\)/);
                          const cleanStopName = match ? match[1].trim() : stop;
                          const stopKm = match ? `${match[2]} km` : null;
                          return (
                            <>
                              <h3 className={`font-bold text-sm ${index === activeStopIndex ? 'text-blue-400' : index < activeStopIndex ? 'text-emerald-400/70' : index === stopsToDisplay.length - 1 ? 'text-emerald-400' : 'text-slate-300 group-hover:text-white transition-colors'}`}>
                                {t(cleanStopName)}
                              </h3>
                              <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-wider">
                                {index === 0 ? t('starting_point') : index === stopsToDisplay.length - 1 ? t('destination') : stopKm || t('intermediate_stop')}
                              </p>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    {/* Connecting Line */}
                    {index < stopsToDisplay.length - 1 && (
                      <div className={`h-1 w-60 shrink-0 -mx-28 mt-[10px] z-0 rounded-full transition-colors duration-500 ${index < activeStopIndex ? 'bg-emerald-500' : 'bg-slate-800'}`}></div>
                    )}
                  </React.Fragment>
                ));
              })()}
              </div>
            </div>
          </div>
        </div>

        {/* Live GPS Map HUD Widget */}
        <div className="p-8 space-y-6 border-t border-white/5">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Navigation className="text-blue-500 animate-pulse" />
                {t('live_tracking_map')}
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                {currentTrip?.status === 'ON_TRIP' 
                  ? `${t('currently_in_transit')} • ${t(currentTrip.from)} → ${t(currentTrip.to)}`
                  : t('resting_terminal')}
              </p>
            </div>
            
            {currentTrip?.status === 'ON_TRIP' && (
              <div className="flex items-center gap-4 bg-blue-500/10 border border-blue-500/20 px-4 py-2 rounded-2xl">
                <div className="relative">
                  <div className="h-3 w-3 rounded-full bg-blue-500 animate-ping"></div>
                  <div className="h-3 w-3 rounded-full bg-blue-500 absolute inset-0"></div>
                </div>
                <div>
                  <span className="text-slate-400 text-xs font-bold uppercase tracking-widest block">{t('next_stop_eta')}</span>
                  <span className="text-lg font-black text-blue-400">{getSimulatedLivePosition()?.etaString} ({t(getSimulatedLivePosition()?.nextStop?.replace(/\s*\(\s*[0-9.]+\s*\)/, ''))})</span>
                </div>
              </div>
            )}
          </div>

          {/* SVG Animated Route Pipeline Track */}
          <div className="relative bg-slate-900/40 border border-white/5 p-6 rounded-3xl overflow-hidden shadow-inner">
            {/* HUD Scanning Line */}
            <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent top-0 animate-pulse"></div>
            
            {/* Live Progress Bar and Bus Position with Custom Scrollbar */}
            <div className="overflow-x-auto custom-scrollbar pb-16 pt-4">
              <div 
                className="relative py-8"
                style={{ minWidth: `${Math.max(600, (getSimulatedLivePosition()?.stopsList?.length || 2) * 220)}px` }}
              >
                {/* Main Track Highway Line */}
                <div className="absolute inset-x-20 top-1/2 -translate-y-1/2 h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 transition-all duration-1000"
                    style={{ width: `${(getSimulatedLivePosition()?.progress || 0) * 100}%` }}
                  />
                </div>

                {/* Stops Pins along the track */}
                <div className="relative flex justify-between items-center w-full z-10 px-20">
                  {getSimulatedLivePosition()?.stopsList?.map((stop, index) => {
                    const isPassed = index < (getSimulatedLivePosition()?.activeStopIndex || 0);
                    const isCurrent = index === (getSimulatedLivePosition()?.activeStopIndex || 0);
                    
                    return (
                      <div key={index} className="flex flex-col items-center relative group">
                        {/* Node circle */}
                        <div className={`w-5 h-5 rounded-full border-4 border-[#0f172a] transition-all duration-500 flex items-center justify-center ${
                          isCurrent 
                            ? 'bg-blue-400 scale-125 ring-4 ring-blue-500/20' 
                            : isPassed 
                              ? 'bg-emerald-500' 
                              : 'bg-slate-700'
                        }`}>
                          {isCurrent && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></div>}
                        </div>
                        
                        {/* Stop Label */}
                        <div className="absolute top-7 left-1/2 -translate-x-1/2 whitespace-nowrap text-center flex flex-col items-center">
                          <span className={`text-[10px] font-bold tracking-tight transition-colors ${
                            isCurrent ? 'text-blue-400 font-extrabold' : isPassed ? 'text-emerald-400/80' : 'text-slate-500'
                          }`}>
                            {t(stop.replace(/\s*\(\s*[0-9.]+\s*\)/, ''))}
                          </span>
                          {isCurrent && (
                            <span className="text-[8px] font-black uppercase text-blue-500 tracking-tighter bg-blue-500/10 px-1 py-0.5 rounded mt-0.5">
                              {t('current')}
                            </span>
                          )}
                          {isPassed && (
                            <span className="text-[8px] font-black uppercase text-emerald-500/70 tracking-tighter mt-0.5">
                              {t('passed')}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Sliding glowing Bus indicator */}
                {currentTrip?.status === 'ON_TRIP' && (
                  <motion.div 
                    className="absolute top-[21px] -translate-y-1/2 z-20"
                    style={{ left: `calc(80px + (${(getSimulatedLivePosition()?.progress || 0)} * (100% - 160px)) - 14px)` }}
                    animate={{ y: [0, -3, 0] }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                  >
                    <div className="bg-blue-500 text-white p-1.5 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.6)] border-2 border-white flex items-center justify-center">
                      <Navigation size={12} className="rotate-90" />
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
            
            {/* Dashboard Speedometer & Simulated HUD Stats */}
            <div className="grid grid-cols-3 gap-4 pt-12 border-t border-white/5 mt-6 text-center">
              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">{t('simulated_speed')}</span>
                <span className="text-lg font-black text-blue-400 font-mono">
                  {currentTrip?.status === 'ON_TRIP' ? `48 km/h` : '0 km/h'}
                </span>
              </div>
              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">{t('status_signal')}</span>
                <span className="text-lg font-black text-emerald-400 font-mono">98% SECURE</span>
              </div>
              <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">{t('next_destination')}</span>
                <span className="text-lg font-black text-indigo-400 truncate block px-2">
                  {getSimulatedLivePosition()?.nextStop ? t(getSimulatedLivePosition().nextStop.replace(/\s*\(\s*[0-9.]+\s*\)/, '')) : '--'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Smart Fare Calculator & Interactive Digital Boarding Pass */}
        <div className="p-8 space-y-6 border-t border-white/5 bg-slate-950/20">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Banknote className="text-blue-500" />
              {t('fare_estimate')} &amp; {t('digital_boarding_pass')}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {t('fare_instructions')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Input Selectors Card */}
            <div className="space-y-4 bg-slate-900/40 border border-white/5 p-6 rounded-3xl">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">
                  {t('boarding_point')}
                </label>
                <select
                  value={boardStop}
                  onChange={(e) => { setBoardStop(e.target.value); setTicketGenerated(false); }}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-slate-200 font-bold focus:ring-2 focus:ring-blue-500/50 outline-none"
                >
                  {bus.route_stops?.map((stop, idx) => {
                    const match = stop.match(/(.+?)\s*\(\s*([0-9.]+)\s*\)/);
                    const cleanName = match ? match[1].trim() : stop;
                    const kmSuffix = match ? ` (${match[2]} km)` : '';
                    return (
                      <option key={idx} value={stop}>{t(cleanName)}{kmSuffix}</option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">
                  {t('drop_point')}
                </label>
                <select
                  value={alightStop}
                  onChange={(e) => { setAlightStop(e.target.value); setTicketGenerated(false); }}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-slate-200 font-bold focus:ring-2 focus:ring-blue-500/50 outline-none"
                >
                  {bus.route_stops?.map((stop, idx) => {
                    const match = stop.match(/(.+?)\s*\(\s*([0-9.]+)\s*\)/);
                    const cleanName = match ? match[1].trim() : stop;
                    const kmSuffix = match ? ` (${match[2]} km)` : '';
                    return (
                      <option key={idx} value={stop}>{t(cleanName)}{kmSuffix}</option>
                    );
                  })}
                </select>
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">
                  {t('passenger')}
                </label>
                <input
                  type="text"
                  value={passengerName}
                  onChange={(e) => { setPassengerName(e.target.value); setTicketGenerated(false); }}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-slate-200 font-bold focus:ring-2 focus:ring-blue-500/50 outline-none"
                />
              </div>

              {/* Visual Seat Map */}
              <div className="space-y-3 pt-2">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block">
                  {t('select_seat')}
                </label>
                
                <div className="bg-slate-950/80 p-4 rounded-2xl border border-white/10 flex flex-col items-center">
                  {/* Bus Front Indicator */}
                  <div className="w-full flex justify-between items-center pb-3 border-b border-white/10 mb-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                    <span>{t('driver')}</span>
                    <span className="w-6 h-6 border border-slate-700 rounded-full flex items-center justify-center text-[10px] text-slate-500">⭕</span>
                    <span>{t('exit')}</span>
                  </div>

                  {/* Seat Grid: 2 Seats | Aisle | 2 Seats */}
                  <div className="grid grid-cols-5 gap-2.5 max-w-[220px]">
                    {Array.from({ length: 24 }, (_, i) => {
                      const seatNo = i + 1;
                      const isOccupied = [3, 5, 8, 12, 14, 19, 22].includes(seatNo);
                      const isSelected = selectedSeat === seatNo;
                      
                      return (
                        <React.Fragment key={seatNo}>
                          <button
                            type="button"
                            disabled={isOccupied}
                            onClick={() => {
                              setSelectedSeat(isSelected ? null : seatNo);
                              setTicketGenerated(false);
                            }}
                            className={`w-8 h-8 rounded-lg text-[10px] font-bold flex items-center justify-center transition-all cursor-pointer ${
                              isOccupied 
                                ? 'bg-slate-800 text-slate-600 border border-transparent' 
                                : isSelected 
                                  ? 'bg-blue-500 text-white font-black scale-110 shadow-[0_0_10px_rgba(59,130,246,0.6)] border-2 border-white' 
                                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20'
                            }`}
                            title={`Seat ${seatNo}`}
                          >
                            {seatNo}
                          </button>
                          
                          {seatNo % 4 === 2 && <div className="w-4 shrink-0" />}
                        </React.Fragment>
                      );
                    })}
                  </div>
                  
                  {/* Selected Seat Legend */}
                  <div className="flex gap-4 mt-4 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded bg-slate-800" />
                      <span>Occupied</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded bg-emerald-500/10 border border-emerald-500/20" />
                      <span>Available</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2.5 h-2.5 rounded bg-blue-500 border border-white" />
                      <span>Selected</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Computed parameters display */}
              {boardStop !== alightStop ? (() => {
                const journey = getJourneyDetails(bus, boardStop, alightStop);
                if (!journey) return null;
                const { distance: distanceVal, duration: durationVal, fare: fareVal, isExpress, baseFare, pricePerKm } = journey;
                
                const handleGenerateTicket = () => {
                  if (!ticketNo) {
                    const randNo = "TKT-TNSTC-" + Math.floor(100000 + Math.random() * 900000);
                    setTicketNo(randNo);
                  }
                  setTicketGenerated(true);
                  showToast((t('digital_boarding_pass') || 'Digital Boarding Pass') + ' ' + (t('done') || 'generated!'));
                };
                
                return (
                  <div className="pt-4 border-t border-white/5 space-y-4">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div className="bg-slate-950/40 p-3 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">{t('distance')}</span>
                        <span className="text-base font-bold text-slate-200 font-mono">{distanceVal} km</span>
                      </div>
                      <div className="bg-slate-950/40 p-3 rounded-2xl border border-white/5">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">{t('travel_time')}</span>
                        <span className="text-base font-bold text-slate-200 font-mono">~{durationVal} {t('mins_left').split(' ')[0]}</span>
                      </div>
                    </div>
                    
                    <div className="space-y-3 bg-slate-900/60 p-4 rounded-2xl border border-white/5">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">
                        {t('boarding_pass_summary')}
                      </span>
                      
                      <div className="flex justify-between text-xs text-slate-400 font-medium">
                        <span>{t('base_fare_label')}</span>
                        <span className="font-mono text-slate-200">₹{baseFare}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 font-medium">
                        <span>{t('distance_fare')} ({distanceVal} km x ₹{pricePerKm})</span>
                        <span className="font-mono text-slate-200">₹{Math.round(distanceVal * pricePerKm)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400 font-medium">
                        <span>{t('tax_service')}</span>
                        <span className="font-mono text-slate-200">₹3</span>
                      </div>
                      
                      <div className="h-px bg-white/5 my-2" />
                      
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-[10px] font-black text-blue-400 block uppercase tracking-wider">{t('total_fare')}</span>
                          <span className="text-2xl font-black text-white font-mono">₹{fareVal + 3}</span>
                        </div>
                        <span className="text-[10px] font-black uppercase bg-blue-500/20 text-blue-400 px-3 py-1.5 rounded-xl border border-blue-500/20">
                          {isExpress ? t('express_fare') : t('ordinary_fare')}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={handleGenerateTicket}
                      className="w-full bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold py-3.5 px-4 rounded-2xl transition-all shadow-[0_4px_15px_rgba(37,99,235,0.4)] flex items-center justify-center gap-2 text-sm uppercase tracking-wider cursor-pointer"
                    >
                      <CheckCircle size={18} />
                      {t('generate_boarding_pass')}
                    </button>
                  </div>
                );
              })() : (
                <div className="text-center py-10 text-slate-500 font-semibold text-sm">
                  {t('select_different_stops')}
                </div>
              )}
            </div>

            {/* Ticket Boarding Pass display container */}
            <div className="flex items-center justify-center relative min-h-[300px]">
              <AnimatePresence mode="wait">
                {ticketGenerated && boardStop !== alightStop ? (() => {
                  const journey = getJourneyDetails(bus, boardStop, alightStop);
                  if (!journey) return null;
                  const { fare: fareVal, isExpress } = journey;
                  
                  return (
                    <motion.div
                      key="ticket-pass"
                      initial={{ opacity: 0, scale: 0.8, rotateY: -180 }}
                      animate={{ opacity: 1, scale: 1, rotateY: 0 }}
                      exit={{ opacity: 0, scale: 0.8, rotateY: 180 }}
                      transition={{ type: "spring", stiffness: 100, damping: 15 }}
                      className="w-full max-w-[340px] bg-gradient-to-b from-slate-50 to-slate-100 text-slate-900 rounded-3xl shadow-2xl border border-white overflow-hidden relative animate-shine-container"
                    >
                      {/* Holographic light reflection sweep animation styling */}
                      <div className="animate-shine pointer-events-none" />

                      {/* Ticket Header */}
                      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white p-5 text-center relative">
                        <div className="absolute top-2 left-4 text-[8px] font-bold uppercase tracking-widest text-blue-200">
                          {t('agency_name')}
                        </div>
                        <h3 className="text-lg font-black tracking-tight uppercase mt-2">
                          {t('digital_boarding_pass')}
                        </h3>
                        <div className="text-[9px] font-semibold text-blue-100 uppercase tracking-widest mt-0.5">
                          {bus.bus_no} • {isExpress ? t('express_fare') : t('ordinary_fare')}
                        </div>
                        
                        {/* Half circle cutouts on left and right for ticket tearing look */}
                        <div className="absolute -bottom-3 -left-3 w-6 h-6 rounded-full bg-[#0f172a]" />
                        <div className="absolute -bottom-3 -right-3 w-6 h-6 rounded-full bg-[#0f172a]" />
                      </div>

                      {/* Ticket Body details */}
                      <div className="p-5 space-y-4 border-b border-dashed border-slate-300 relative">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{t('boarding_point')}</span>
                            <span className="text-sm font-black text-slate-800 truncate block">{t(boardStop.replace(/\s*\(\s*[0-9.]+\s*\)/, ''))}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{t('drop_point')}</span>
                            <span className="text-sm font-black text-slate-800 truncate block">{t(alightStop.replace(/\s*\(\s*[0-9.]+\s*\)/, ''))}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{t('passenger')}</span>
                            <span className="text-xs font-bold text-slate-700 truncate block max-w-[140px]">{passengerName || t('passenger_name')}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{selectedSeat ? t('selected_seat') : t('seats_status')}</span>
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-block ${
                              selectedSeat 
                                ? 'text-blue-700 bg-blue-100 font-extrabold animate-pulse' 
                                : 'text-emerald-600 bg-emerald-100'
                            }`}>
                              {selectedSeat ? `${t('seat')} #${selectedSeat}` : t('seats_available')}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                          <div>
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{t('ticket_no')}</span>
                            <span className="text-[10px] font-mono font-bold text-slate-700">{ticketNo}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">{t('fare_paid')}</span>
                            <span className="text-lg font-black text-slate-950 font-mono">₹{fareVal + 3}</span>
                          </div>
                        </div>
                      </div>

                      {/* Ticket Barcode Footer */}
                      <div className="p-5 bg-white text-center flex flex-col items-center justify-center">
                        {/* Barcode lines via simple styled divs */}
                        <div className="flex items-center justify-center h-12 w-full gap-[2px] opacity-80 overflow-hidden">
                          {[1,3,1,2,4,1,2,3,1,2,1,4,1,3,1,2,4,1,2,3,1,2,1,4,1,3,1].map((w, i) => (
                            <div key={i} className="bg-slate-950 h-full rounded-sm" style={{ width: `${w * 1.5}px` }} />
                          ))}
                        </div>
                        <span className="text-[9px] font-mono font-bold text-slate-500 tracking-[0.25em] mt-2 uppercase">
                          {ticketNo}
                        </span>
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-1.5 flex items-center gap-1">
                          <CheckCircle size={10} className="text-emerald-500" />
                          {t('barcode_verify')}
                        </span>
                      </div>
                    </motion.div>
                  );
                })() : (
                  <motion.div
                    key="ticket-empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center text-slate-500 border border-dashed border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center gap-3 w-full max-w-[340px]"
                  >
                    <div className="p-4 rounded-full bg-white/5 text-slate-400">
                      <Banknote size={32} />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-slate-300">{t('fare_estimate')}</p>
                      <p className="text-xs text-slate-500 mt-1 max-w-[200px] mx-auto">
                        {t('fill_journey_details')}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6 bg-slate-900/30">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Clock className="text-blue-500" />
              {t('full_day_timesheet')}
            </h2>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-widest bg-slate-800 px-3 py-1 rounded-full">
              {t('full_circle')} {bus.full_schedule?.length || 0} {t('events')}
            </div>
          </div>

          <div className="overflow-hidden border border-white/5 rounded-2xl">
            <table className="w-full text-left">
              <thead className="bg-slate-900/50">
                <tr>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">{t('trip')}</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">{t('route')}</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">{t('dep')}</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">{t('arr')}</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">{t('status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {bus.full_schedule && bus.full_schedule.map((trip, idx) => {
                  const isActive = currentTrip && 
                                 currentTrip.trip_no === trip.trip_no && 
                                 (currentTrip.status === 'ON_TRIP' || currentTrip.status === 'DP_WAITING');
                  
                  return (
                    <tr key={idx} className={`${trip.is_break ? 'bg-amber-500/5' : isActive ? 'bg-blue-500/10 border-l-4 border-blue-500' : 'hover:bg-white/5'} transition-all`}>
                      <td className="px-6 py-4 font-bold text-slate-400">
                        {isActive && <span className="flex h-2 w-2 rounded-full bg-blue-500 mr-2 inline-block animate-ping"></span>}
                        #{trip.trip_no || idx + 1}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-semibold ${trip.is_break ? 'text-amber-400' : isActive ? 'text-blue-400' : 'text-slate-200'}`}>
                          {t(trip.from)} → {t(trip.to)}
                        </span>
                        {trip.note && <div className="text-xs text-amber-500/70 font-medium">{t(trip.note)}</div>}
                        {isActive && <div className="text-[10px] font-black text-blue-500 uppercase mt-1">{t('current_active_trip')}</div>}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-300">{trip.departure}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-300">{trip.arrival}</td>
                      <td className="px-6 py-4">
                        {trip.is_break ? (
                          <span className="bg-amber-500/10 text-amber-500 text-[10px] font-black px-2 py-1 rounded uppercase">{t('break')}</span>
                        ) : isActive ? (
                          <span className="bg-blue-500/20 text-blue-400 text-[10px] font-black px-2 py-1 rounded uppercase">{t('current')}</span>
                        ) : (
                          <span className="bg-emerald-500/10 text-emerald-500 text-[10px] font-black px-2 py-1 rounded uppercase">{t('on_duty')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-slate-900/50 p-6 border-t border-white/5">
          <div className="flex items-center gap-3 text-slate-400 text-sm italic font-medium">
            <Shield size={16} className="text-blue-500" />
            {t('note_timings')} {new Date(bus.last_updated).toLocaleDateString()}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowReportModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative glass-card border-white/10 max-w-md w-full p-6 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black flex items-center gap-2 text-yellow-400">
                  <AlertTriangle /> {t('report_status')}
                </h3>
                <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
              </div>
              <p className="text-slate-300 text-sm">{t('help_other_commuters')}</p>
              
              <div className="grid grid-cols-2 gap-3">
                {['Departed Early', 'Delayed', 'At Stand', 'Broken Down'].map(status => (
                  <button 
                    key={status}
                    onClick={() => submitReport(status)}
                    disabled={reportSubmitting}
                    className="p-3 bg-slate-800 hover:bg-yellow-500/20 hover:text-yellow-400 hover:border-yellow-500/30 border border-white/5 rounded-xl text-sm font-bold transition-all text-slate-300 disabled:opacity-50"
                  >
                    {t(status.toLowerCase().replace(' ', '_')) || status}
                  </button>
                ))}
                <button 
                  onClick={() => submitReport(null)}
                  disabled={reportSubmitting}
                  className="col-span-2 mt-2 p-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 hover:border-red-500/30 rounded-xl text-sm font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <X size={16} /> {t('clear_status')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.3 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 z-[60] border border-white/20 backdrop-blur-md ${
              toast.type === 'error' ? 'bg-red-500/90 text-white' : 'bg-emerald-500/90 text-white'
            }`}
          >
            {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
            <span className="font-bold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BusDetails;
