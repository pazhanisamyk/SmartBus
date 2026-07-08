/* eslint-disable react/prop-types */
import { useNavigate } from 'react-router-dom';
import { Clock, MapPin, Info, Navigation, AlertCircle, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { getCurrentTrip } from '../utils/busUtils';

const BusCard = ({ bus, isFavorite, toggleFavorite }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const currentTrip = getCurrentTrip(bus.full_schedule);

  const getStatusDisplay = (status) => {
    switch (status) {
      case 'ON_TRIP': return { label: t('in_transit'), color: 'bg-emerald-500', icon: <Navigation size={12} className="animate-pulse" /> };
      case 'BREAK': return { label: t('on_break'), color: 'bg-amber-500', icon: <Clock size={12} /> };
      case 'DP_WAITING': return { label: t('at_stand'), color: 'bg-blue-500', icon: <MapPin size={12} /> };
      case 'UPCOMING': return { label: t('starting_soon'), color: 'bg-indigo-500', icon: <Clock size={12} /> };
      case 'COMPLETED': return { label: t('done'), color: 'bg-slate-500', icon: <Info size={12} /> };
      default: return null;
    }
  };

  const displayFrom = (currentTrip && currentTrip.from) || bus.start_place;
  const displayTo = (currentTrip && currentTrip.to) || bus.end_place;
  const displayDep = (currentTrip && currentTrip.departure) || bus.departure_time;
  const displayArr = (currentTrip && currentTrip.arrival) || bus.end_time;

  const statusInfo = currentTrip ? getStatusDisplay(currentTrip.status) : null;

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-5 cursor-pointer hover:bg-white/15 transition-all group"
      onClick={() => navigate(`/bus/${bus._id}`)}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-blue-600/20 text-blue-400 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              {t(bus.bus_name)}
            </span>
            {statusInfo && currentTrip?.status !== 'COMPLETED' && (
              <span className={`${statusInfo.color} text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase flex items-center gap-1`}>
                {statusInfo.icon}
                {currentTrip.trip_no ? `Trip #${currentTrip.trip_no}: ` : ''}{statusInfo.label}
              </span>
            )}
          </div>
          <h3 className="text-2xl font-bold text-white group-hover:text-blue-400 transition-colors">
            {bus.bus_no}
          </h3>
        </div>
        <div className="text-right flex flex-col items-end">
          <button 
            onClick={(e) => { e.stopPropagation(); toggleFavorite(bus._id); }}
            className={`p-1.5 rounded-full mb-1 transition-colors ${isFavorite ? 'text-yellow-400 bg-yellow-400/10' : 'text-slate-500 hover:text-yellow-400 hover:bg-yellow-400/10'}`}
          >
            <Star size={16} fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
          <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">{t('platform')}</div>
          <div className="text-2xl font-bold text-blue-400">{bus.platform || '--'}</div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="flex flex-col items-center">
            <div className={`w-2 h-2 rounded-full ${currentTrip?.status === 'ON_TRIP' ? 'bg-blue-400' : 'bg-blue-500 animate-pulse'}`}></div>
            <div className="w-0.5 h-6 bg-slate-700"></div>
            <div className={`w-2 h-2 rounded-full ${currentTrip?.status === 'ON_TRIP' ? 'bg-emerald-500 animate-pulse' : 'bg-emerald-500'}`}></div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center text-sm">
              <span className={`font-medium ${currentTrip?.status === 'ON_TRIP' ? 'text-slate-400' : 'text-slate-200'}`}>{t(displayFrom)}</span>
              <span className="text-slate-400 font-mono text-xs">{displayDep}</span>
            </div>
            <div className="flex justify-between items-center text-sm mt-3">
              <span className={`font-medium ${currentTrip?.status === 'ON_TRIP' ? 'text-emerald-400' : 'text-slate-200'}`}>{t(displayTo)}</span>
              <span className="text-slate-400 font-mono text-xs">{displayArr}</span>
            </div>
          </div>
        </div>

        {currentTrip && currentTrip.is_break && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-2 rounded-lg flex items-center gap-2">
            <AlertCircle size={14} className="text-amber-500" />
            <div className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
              {t('currently_on_break')} {currentTrip.note ? t(currentTrip.note) : t('Rest & Lunch')}
            </div>
          </div>
        )}


        <div className="pt-4 border-t border-white/5 flex items-center justify-between text-xs text-slate-400 font-medium">
          <div className="flex items-center gap-1">
            <Clock size={14} />
            <span>{bus.travel_time || 'N/A'}</span>
          </div>
          <div className="flex items-center gap-1">
            <Info size={14} className="text-blue-400" />
            <span className="text-blue-400">{t('view_route_details')}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default BusCard;
