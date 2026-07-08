import { useState, useEffect } from 'react';
import { busApi } from '../services/api';
import { Search, Grid, List as ListIcon, RefreshCw, Star } from 'lucide-react';
import BusCard from '../components/BusCard';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { getCurrentTrip, parseTime } from '../utils/busUtils';

const Home = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchMode, setSearchMode] = useState('bus'); // 'bus' or 'route'
  const [fromSearch, setFromSearch] = useState('');
  const [toSearch, setToSearch] = useState('');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'board'
  const [favorites, setFavorites] = useState(JSON.parse(localStorage.getItem('busFavorites') || '[]'));
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('departure');

  const toggleFavorite = (id) => {
    let newFavs = [...favorites];
    if (newFavs.includes(id)) {
      newFavs = newFavs.filter(favId => favId !== id);
    } else {
      newFavs.push(id);
    }
    setFavorites(newFavs);
    localStorage.setItem('busFavorites', JSON.stringify(newFavs));
  };

  const fetchBuses = async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchMode === 'route') {
        params.from = fromSearch;
        params.to = toSearch;
      } else {
        params.search = searchTerm;
      }
      const res = await busApi.getAll(params);
      setBuses(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      fetchBuses();
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, fromSearch, toSearch, searchMode]);

  // Periodic refresh to update 'current trip' status as time moves forward
  useEffect(() => {
    const interval = setInterval(() => {
      // We don't necessarily need to fetch again if we just want to update the 'now' reference
      // but triggering a re-render is enough since BusCard/Table-row compute current trip on render
      setBuses(prev => [...prev]); 
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const parseDuration = (durStr) => {
    if (!durStr) return 0;
    const hrsMatch = durStr.match(/(\d+)\s*hour/i);
    const minsMatch = durStr.match(/(\d+)\s*min/i);
    const hrs = hrsMatch ? parseInt(hrsMatch[1]) : 0;
    const mins = minsMatch ? parseInt(minsMatch[1]) : 0;
    return hrs * 60 + mins;
  };

  const getFilteredAndSortedBuses = () => {
    let result = buses.filter(bus => {
      // 1. Favorites filter
      if (showOnlyFavorites && !favorites.includes(bus._id)) return false;

      // 2. Type filter
      const isExpress = bus.bus_name?.toLowerCase().includes('express') || 
                        bus.bus_name?.toLowerCase().includes('deluxe') || 
                        bus.bus_name?.toLowerCase().includes('bypass');
      if (filterType === 'express' && !isExpress) return false;
      if (filterType === 'ordinary' && isExpress) return false;

      // 3. Status filter
      const currentTrip = getCurrentTrip(bus.full_schedule);
      const status = currentTrip?.status || 'COMPLETED';
      if (filterStatus === 'in_transit' && status !== 'ON_TRIP') return false;
      if (filterStatus === 'at_stand' && status !== 'DP_WAITING') return false;
      if (filterStatus === 'on_break' && status !== 'BREAK') return false;

      return true;
    });

    // 4. Sort
    result.sort((a, b) => {
      if (sortBy === 'departure') {
        const tripA = getCurrentTrip(a.full_schedule);
        const tripB = getCurrentTrip(b.full_schedule);
        const depA = parseTime(tripA?.departure || a.departure_time);
        const depB = parseTime(tripB?.departure || b.departure_time);
        return depA - depB;
      }
      if (sortBy === 'duration') {
        return parseDuration(a.travel_time) - parseDuration(b.travel_time);
      }
      if (sortBy === 'distance') {
        return parseInt(a.distance || 0) - parseInt(b.distance || 0);
      }
      return 0;
    });

    return result;
  };

  return (
    <div className="space-y-8">
      {/* Hero Section / Search */}
      <section className="text-center space-y-6 py-12">
        <motion.h1 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-4xl md:text-6xl font-black"
        >
          {t('never_miss')} <span className="text-blue-500">{t('bus')}</span> {t('again')}
        </motion.h1>
        <p className="text-slate-400 text-lg max-w-2xl mx-auto font-medium">
          {t('hero_subtitle')}
        </p>

        {/* Search Mode Tabs */}
        <div className="flex justify-center space-x-4 mb-2">
          <button
            onClick={() => setSearchMode('bus')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              searchMode === 'bus'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {t('search_mode_bus')}
          </button>
          <button
            onClick={() => setSearchMode('route')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
              searchMode === 'route'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
          >
            {t('search_mode_route')}
          </button>
        </div>

        {searchMode === 'bus' ? (
          <div className="max-w-3xl mx-auto relative group">
            <div className="absolute inset-0 bg-blue-500/20 blur-2xl group-hover:bg-blue-500/30 transition-all rounded-3xl"></div>
            <div className="relative glass-card flex items-center p-2">
              <div className="pl-4 pr-2 text-slate-400">
                <Search size={22} />
              </div>
              <input 
                type="text" 
                placeholder={t('search_placeholder')}
                className="w-full bg-transparent border-none focus:ring-0 py-4 text-lg font-medium placeholder:text-slate-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto relative group">
            <div className="absolute inset-0 bg-blue-500/20 blur-2xl group-hover:bg-blue-500/30 transition-all rounded-3xl"></div>
            <div className="relative glass-card flex flex-col md:flex-row items-center p-2 gap-2">
              <div className="flex items-center w-full p-2 gap-2 border-b border-white/5 md:border-b-0 md:border-r md:border-white/10">
                <div className="text-slate-400 shrink-0">
                  <Search size={20} />
                </div>
                <input 
                  type="text" 
                  placeholder={t('from_place')}
                  className="w-full bg-transparent border-none focus:ring-0 py-3 text-base font-semibold placeholder:text-slate-500 outline-none"
                  value={fromSearch}
                  onChange={(e) => setFromSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center w-full p-2 gap-2">
                <div className="text-slate-400 shrink-0">
                  <Search size={20} />
                </div>
                <input 
                  type="text" 
                  placeholder={t('to_place')}
                  className="w-full bg-transparent border-none focus:ring-0 py-3 text-base font-semibold placeholder:text-slate-500 outline-none"
                  value={toSearch}
                  onChange={(e) => setToSearch(e.target.value)}
                />
              </div>
              <button 
                onClick={fetchBuses}
                className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-xl transition-all shrink-0 active:scale-95 cursor-pointer uppercase text-xs tracking-wider"
              >
                {t('search_btn')}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* View Options & Board */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 py-4 border-b border-white/5">
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg flex items-center gap-2 transition-all ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-slate-400'}`}
          >
            <Grid size={18} />
            <span className="text-sm font-semibold">{t('grid_view')}</span>
          </button>
          <button 
            onClick={() => setViewMode('board')}
            className={`p-2 rounded-lg flex items-center gap-2 transition-all ${viewMode === 'board' ? 'bg-blue-600 text-white' : 'hover:bg-white/10 text-slate-400'}`}
          >
            <ListIcon size={18} />
            <span className="text-sm font-semibold">{t('stand_board')}</span>
          </button>
          <button 
            onClick={() => setShowOnlyFavorites(!showOnlyFavorites)}
            className={`p-2 rounded-lg flex items-center gap-2 transition-all ml-4 border ${showOnlyFavorites ? 'bg-yellow-400/20 text-yellow-400 border-yellow-400/30' : 'hover:bg-white/10 text-slate-400 border-transparent'}`}
          >
            <Star size={18} fill={showOnlyFavorites ? "currentColor" : "none"} />
            <span className="text-sm font-semibold">{t('saved_buses')}</span>
          </button>
        </div>
        
        <div className="flex items-center text-sm font-medium text-slate-400 bg-slate-900/50 px-4 py-2 rounded-full border border-white/5">
          <RefreshCw size={14} className="mr-2 animate-spin-slow" />
          {t('live_updates')}
        </div>
      </div>

      {/* Advanced Filters & Sorting */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-slate-950/40 rounded-2xl border border-white/5">
        <div className="flex flex-wrap items-center gap-6">
          {/* Category/Type Filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t('filter_by')} {t('bus')}</span>
            <div className="flex bg-slate-900/80 p-1 rounded-xl border border-white/5">
              {['all', 'express', 'ordinary'].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFilterType(type)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all duration-200 cursor-pointer ${filterType === type ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {type === 'all' ? t('all_buses') : t(type)}
                </button>
              ))}
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t('status')}</span>
            <div className="flex bg-slate-900/80 p-1 rounded-xl border border-white/5">
              {['all', 'in_transit', 'at_stand', 'on_break'].map(status => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilterStatus(status)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all duration-200 cursor-pointer ${filterStatus === status ? 'bg-blue-600 text-white shadow-md shadow-blue-500/25' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  {status === 'all' ? t('all_buses') : t(status)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sort Controls */}
        <div className="flex flex-col gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">{t('sort_by')}</span>
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-900 border border-white/10 rounded-xl px-4 py-2 text-xs font-bold text-slate-200 focus:border-blue-500 outline-none transition-all cursor-pointer"
            >
              <option value="departure">{t('departure_time_label')}</option>
              <option value="duration">{t('duration_label')}</option>
              <option value="distance">{t('distance_label')}</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {viewMode === 'grid' ? (
            <motion.div 
              key="grid"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {getFilteredAndSortedBuses().map(bus => (
                <BusCard 
                  key={bus._id} 
                  bus={bus} 
                  isFavorite={favorites.includes(bus._id)}
                  toggleFavorite={toggleFavorite}
                />
              ))}
            </motion.div>
          ) : (
            <motion.div 
              key="board"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="glass-card overflow-hidden"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-900/50 border-b border-white/10">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">★</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">{t('bus_no')}</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">{t('route')}</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">{t('arrival')}</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">{t('departure')}</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">{t('status')}</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500">{t('platform')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                     {getFilteredAndSortedBuses().map(bus => {
                       const currentTrip = getCurrentTrip(bus.full_schedule);
                       const statusLabel = currentTrip ? (
                         currentTrip.status === 'ON_TRIP' ? t('in_transit') :
                         currentTrip.status === 'BREAK' ? t('on_break') :
                         currentTrip.status === 'DP_WAITING' ? t('at_stand') :
                         currentTrip.status === 'UPCOMING' ? t('starting_soon') : t('done')
                       ) : '--';
                       
                       const statusColor = currentTrip ? (
                         currentTrip.status === 'ON_TRIP' ? 'text-emerald-400' :
                         currentTrip.status === 'BREAK' ? 'text-amber-400' :
                         currentTrip.status === 'DP_WAITING' ? 'text-blue-400' :
                         currentTrip.status === 'UPCOMING' ? 'text-indigo-400' : 'text-slate-500'
                       ) : 'text-slate-500';

                       const displayFrom = (currentTrip && currentTrip.status !== 'COMPLETED' ? currentTrip.from : bus.start_place);
                       const displayTo = (currentTrip && currentTrip.status !== 'COMPLETED' ? currentTrip.to : bus.end_place);
                       const displayDep = (currentTrip && currentTrip.status !== 'COMPLETED' ? currentTrip.departure : bus.departure_time);
                       const displayArr = (currentTrip && currentTrip.status !== 'COMPLETED' ? currentTrip.arrival : bus.arrival_time);

                       return (
                         <tr key={bus._id} className="hover:bg-white/5 transition-colors cursor-pointer" onClick={() => navigate(`/bus/${bus._id}`)}>
                           <td className="px-6 py-4">
                             <button onClick={(e) => { e.stopPropagation(); toggleFavorite(bus._id); }} className={`p-1 rounded-full ${favorites.includes(bus._id) ? 'text-yellow-400' : 'text-slate-600 hover:text-yellow-400'}`}>
                               <Star size={16} fill={favorites.includes(bus._id) ? 'currentColor' : 'none'} />
                             </button>
                           </td>
                           <td className="px-6 py-4 font-bold text-blue-400">{bus.bus_no}</td>
                           <td className="px-6 py-4 font-medium">
                             <div className="flex flex-col">
                               <span className="text-slate-200">{t(displayFrom)} → {t(displayTo)}</span>
                               {currentTrip?.is_break && <span className="text-[10px] text-amber-500 font-bold uppercase tracking-tighter">{t('break')}: {t(currentTrip.note)}</span>}
                             </div>
                           </td>
                           <td className="px-6 py-4 text-slate-400 font-mono text-sm">{displayArr}</td>
                           <td className="px-6 py-4 text-emerald-400 font-bold font-mono text-sm">{displayDep}</td>
                           <td className="px-6 py-4">
                             <span className={`text-[10px] font-black uppercase px-2 py-1 rounded bg-white/5 border border-white/5 ${statusColor}`}>
                               {currentTrip && currentTrip.trip_no ? `T#${currentTrip.trip_no} ` : ''}{statusLabel}
                             </span>
                           </td>
                           <td className="px-6 py-4">
                             <span className="bg-slate-800 text-blue-400 px-3 py-1 rounded-md border border-white/5 font-bold">
                               {bus.platform || '--'}
                             </span>
                           </td>
                         </tr>
                       );
                     })}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {!loading && getFilteredAndSortedBuses().length === 0 && (
        <div className="text-center py-20 bg-white/5 rounded-3xl border border-dashed border-white/10">
          <p className="text-slate-500 font-medium">{t('no_buses')} &quot;{searchTerm || t('filter_by')}&quot;</p>
        </div>
      )}
    </div>
  );
};

export default Home;
