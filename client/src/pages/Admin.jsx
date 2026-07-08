import { useState, useEffect } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Save, Plus, Trash2, Edit2, X, Clock, MapPin, Coffee, AlertTriangle, CheckCircle, Lock, User, Key, LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getCurrentTrip } from '../utils/busUtils';

const Admin = () => {
  const { t } = useTranslation();
  const [buses, setBuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('adminAuth') === 'true');
  const [adminUser, setAdminUser] = useState(localStorage.getItem('adminUser') || 'admin');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [passStatus, setPassStatus] = useState({ type: '', msg: '' });

  const [formData, setFormData] = useState({
    bus_no: '',
    bus_name: '',
    start_place: '',
    end_place: '',
    arrival_time: '',
    departure_time: '',
    end_time: '',
    platform: '',
    route_stops: '',
    travel_time: '',
    distance: '',
    segment_distance: '',
    base_fare: '',
    price_per_km: ''
  });

  const [scheduleItems, setScheduleItems] = useState([
    { trip_no: 1, from: '', to: '', departure: '', arrival: '', is_break: false, note: '' }
  ]);

  const [status, setStatus] = useState({ type: '', msg: '' });
  const [confirmModal, setConfirmModal] = useState({
    show: false,
    title: '',
    message: '',
    onConfirm: null,
    type: 'danger' // 'danger' or 'success'
  });

  const getFleetStats = () => {
    let totalFleet = buses.length;
    let inTransit = 0;
    let resting = 0;
    let reportedIncidents = 0;

    buses.forEach(bus => {
      const currentTrip = getCurrentTrip(bus.full_schedule);
      if (currentTrip) {
        if (currentTrip.status === 'ON_TRIP') {
          inTransit++;
        } else if (currentTrip.status === 'BREAK' || currentTrip.status === 'DP_WAITING') {
          resting++;
        }
      }
      
      const isReportRecent = bus.crowd_report?.time && (new Date() - new Date(bus.crowd_report.time)) < 2 * 60 * 60 * 1000;
      if (isReportRecent) {
        reportedIncidents++;
      }
    });

    return { totalFleet, inTransit, resting, reportedIncidents };
  };

  const stats = getFleetStats();

  const fetchBuses = async () => {
    try {
      const res = await axios.get('http://localhost:5000/api/buses');
      setBuses(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBuses();
  }, []);

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleScheduleChange = (index, e) => {
    const { name, value, type, checked } = e.target;
    const newItems = [...scheduleItems];
    newItems[index][name] = type === 'checkbox' ? checked : value;
    setScheduleItems(newItems);
  };

  const addScheduleItem = () => {
    setScheduleItems([...scheduleItems, {
      trip_no: scheduleItems.length + 1,
      from: '', to: '', departure: '', arrival: '', is_break: false, note: ''
    }]);
  };

  const removeScheduleItem = (index) => {
    setScheduleItems(scheduleItems.filter((_, i) => i !== index));
  };

  const resetForm = () => {
    setFormData({
      bus_no: '',
      bus_name: '',
      start_place: '',
      end_place: '',
      arrival_time: '',
      departure_time: '',
      end_time: '',
      platform: '',
      route_stops: '',
      travel_time: '',
      distance: '',
      segment_distance: '',
      base_fare: '',
      price_per_km: ''
    });
    setScheduleItems([{ trip_no: 1, from: '', to: '', departure: '', arrival: '', is_break: false, note: '' }]);
    setEditingId(null);
  };

  const handleEdit = (bus) => {
    if (!isAuthenticated) return;
    setEditingId(bus._id);
    setFormData({
      ...bus,
      route_stops: bus.route_stops.join(', ')
    });
    setScheduleItems(bus.full_schedule && bus.full_schedule.length > 0
      ? bus.full_schedule
      : [{ trip_no: 1, from: '', to: '', departure: '', arrival: '', is_break: false, note: '' }]
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', loginForm);
      if (res.data.success) {
        setIsAuthenticated(true);
        setAdminUser(loginForm.username);
        localStorage.setItem('adminAuth', 'true');
        localStorage.setItem('adminUser', loginForm.username);
        setLoginError('');
        fetchBuses();
      }
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Login failed. Please try again.');
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.new !== passwordForm.confirm) {
      setPassStatus({ type: 'error', msg: 'New passwords do not match' });
      return;
    }
    
    try {
      const res = await axios.post('http://localhost:5000/api/auth/update-password', {
        username: adminUser,
        currentPassword: passwordForm.current,
        newPassword: passwordForm.new
      });
      if (res.data.success) {
        setPassStatus({ type: 'success', msg: 'Password updated successfully!' });
        setTimeout(() => {
          setShowSettings(false);
          setPasswordForm({ current: '', new: '', confirm: '' });
          setPassStatus({ type: '', msg: '' });
        }, 2000);
      }
    } catch (err) {
      setPassStatus({ type: 'error', msg: err.response?.data?.message || 'Update failed' });
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('adminAuth');
    localStorage.removeItem('adminUser');
  };

  const handleDelete = (id) => {
    setConfirmModal({
      show: true,
      title: t('confirm_deletion') || 'Confirm Deletion',
      message: t('are_you_sure_delete') || 'Are you sure you want to delete this bus? This action cannot be undone.',
      type: 'danger',
      onConfirm: async () => {
        try {
          await axios.delete(`http://localhost:5000/api/buses/${id}`);
          fetchBuses();
          setConfirmModal(prev => ({ ...prev, show: false }));
        } catch (err) {
          console.error(err);
          setConfirmModal(prev => ({ ...prev, show: false }));
        }
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ type: 'loading', msg: t('processing') || 'Processing...' });

    try {
      const payload = {
        ...formData,
        route_stops: formData.route_stops ? formData.route_stops.split(',').map(s => s.trim()).filter(Boolean) : [],
        segment_distance: formData.segment_distance !== '' && formData.segment_distance !== undefined ? parseFloat(formData.segment_distance) : undefined,
        base_fare: formData.base_fare !== '' && formData.base_fare !== undefined ? parseInt(formData.base_fare, 10) : undefined,
        price_per_km: formData.price_per_km !== '' && formData.price_per_km !== undefined ? parseFloat(formData.price_per_km) : undefined,
        full_schedule: scheduleItems
      };

      if (editingId) {
        await axios.patch(`http://localhost:5000/api/buses/${editingId}`, payload);
        setStatus({ type: 'success', msg: t('bus_schedule_updated') || 'Bus schedule updated!' });
      } else {
        await axios.post('http://localhost:5000/api/buses', payload);
        setStatus({ type: 'success', msg: t('new_bus_added') || 'New bus and schedule added!' });
      }

      resetForm();
      fetchBuses();
      setTimeout(() => setStatus({ type: '', msg: '' }), 3000);
    } catch (err) {
      setStatus({ type: 'error', msg: 'Error: ' + err.message });
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card max-w-md w-full p-10 space-y-8"
        >
          <div className="text-center space-y-4">
            <div className="mx-auto w-20 h-20 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500">
              <Lock size={40} />
            </div>
            <h1 className="text-3xl font-black">{t('admin_access')}</h1>
            <p className="text-slate-400 font-medium italic underline decoration-blue-500/30 underline-offset-4">{t('secure_portal_login')}</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <User size={14} /> {t('username')}
              </label>
              <input 
                type="text"
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none transition-all"
                value={loginForm.username}
                onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <Key size={14} /> {t('password')}
              </label>
              <input 
                type="password"
                className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none transition-all"
                value={loginForm.password}
                onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                required
              />
            </div>

            {loginError && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-3 bg-red-500/20 text-red-500 text-xs font-bold rounded-lg text-center"
              >
                {loginError}
              </motion.div>
            )}

            <button type="submit" className="w-full btn-primary py-4 flex items-center justify-center gap-2 text-lg">
              {t('unlock_terminal')}
            </button>
          </form>
          
          <div className="text-center">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-tighter">{t('protected_by_tnstc')}</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-3xl font-black">{editingId ? t('update_timesheet') : t('create_daily_schedule')}</h1>
            <p className="text-slate-400 font-medium">{t('manage_trips')}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-red-500/10 hover:text-red-500 text-slate-400 rounded-lg text-xs font-black transition-all border border-white/5 uppercase"
          >
            <LogOut size={14} /> {t('exit')}
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-blue-500/10 hover:text-blue-400 text-slate-400 rounded-lg text-xs font-black transition-all border border-white/5 uppercase"
          >
             <Key size={14} /> {t('settings')}
          </button>
        </div>
        {status.msg && (
          <div className={`px-4 py-2 rounded-lg text-sm font-bold ${status.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
            {status.msg}
          </div>
        )}
      </div>

      {/* Fleet Dashboard KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-card p-6 border-l-4 border-blue-500 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/5 rounded-bl-full flex items-center justify-center text-blue-500/10 group-hover:scale-110 transition-transform"><Clock size={36} /></div>
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Total Fleet Size</span>
          <span className="text-3xl font-black text-white mt-2">{stats.totalFleet} buses</span>
        </div>
        
        <div className="glass-card p-6 border-l-4 border-emerald-500 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/5 rounded-bl-full flex items-center justify-center text-emerald-500/10 group-hover:scale-110 transition-transform"><MapPin size={36} /></div>
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Active In Transit</span>
          <span className="text-3xl font-black text-emerald-400 mt-2">{stats.inTransit} active</span>
        </div>

        <div className="glass-card p-6 border-l-4 border-amber-500 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/5 rounded-bl-full flex items-center justify-center text-amber-500/10 group-hover:scale-110 transition-transform"><Coffee size={36} /></div>
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Resting / Stand</span>
          <span className="text-3xl font-black text-amber-400 mt-2">{stats.resting} buses</span>
        </div>

        <div className="glass-card p-6 border-l-4 border-red-500 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/5 rounded-bl-full flex items-center justify-center text-red-500/10 group-hover:scale-110 transition-transform"><AlertTriangle size={36} /></div>
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Reported Delays</span>
          <span className="text-3xl font-black text-red-400 mt-2">{stats.reportedIncidents} incidents</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Core Info */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-8 border-l-4 border-blue-500 space-y-6">
          <h2 className="text-xl font-bold flex items-center gap-2 italic text-blue-400 underline decoration-blue-500/30 underline-offset-8 uppercase tracking-widest text-sm">
            <Edit2 size={16} /> {t('basic_bus_info')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('bus_number')}</label>
              <input name="bus_no" placeholder="e.g. 20A" className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none" value={formData.bus_no} onChange={handleFormChange} required />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('bus_name')}</label>
              <input name="bus_name" placeholder="e.g. TNSTC Ordinary" className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none" value={formData.bus_name} onChange={handleFormChange} required />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('from')}</label>
              <input name="start_place" placeholder="Place" className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none" value={formData.start_place} onChange={handleFormChange} required />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('to')}</label>
              <input name="end_place" placeholder="Place" className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none" value={formData.end_place} onChange={handleFormChange} required />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('platform')}</label>
              <input name="platform" placeholder="3" className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none" value={formData.platform} onChange={handleFormChange} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('stops_comma')}</label>
              <input name="route_stops" placeholder="Stop A, Stop B" className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none" value={formData.route_stops} onChange={handleFormChange} />
            </div>
          </div>

          {/* New Timings inputs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t border-white/5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('arrival')}</label>
              <input name="arrival_time" placeholder="e.g. 08:45 AM" className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none" value={formData.arrival_time || ''} onChange={handleFormChange} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('departure')}</label>
              <input name="departure_time" placeholder="e.g. 09:00 AM" className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none" value={formData.departure_time || ''} onChange={handleFormChange} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">End Time</label>
              <input name="end_time" placeholder="e.g. 10:15 AM" className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none" value={formData.end_time || ''} onChange={handleFormChange} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('travel_time')}</label>
              <input name="travel_time" placeholder="e.g. 1 hour 15 mins" className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none" value={formData.travel_time || ''} onChange={handleFormChange} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t border-white/5">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">{t('distance')} (km)</label>
              <input name="distance" placeholder="e.g. 117" className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none" value={formData.distance} onChange={handleFormChange} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Stop Distance Interval (km)</label>
              <input name="segment_distance" type="number" step="0.1" placeholder="e.g. 6.5" className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none" value={formData.segment_distance} onChange={handleFormChange} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Base Minimum Fare (₹)</label>
              <input name="base_fare" type="number" placeholder="e.g. 10" className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none" value={formData.base_fare} onChange={handleFormChange} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Ticket Price Per KM (₹)</label>
              <input name="price_per_km" type="number" step="0.01" placeholder="e.g. 0.78" className="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none" value={formData.price_per_km} onChange={handleFormChange} />
            </div>
          </div>
        </motion.div>

        {/* Schedule Builder */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-card p-8 border-l-4 border-emerald-500 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2 italic text-emerald-400 underline decoration-emerald-500/30 underline-offset-8 uppercase tracking-widest text-sm">
              <Clock size={16} /> {t('daily_timesheet_builder')}
            </h2>
            <button type="button" onClick={addScheduleItem} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all">
              <Plus size={14} /> {t('add_trip')}
            </button>
          </div>

          <div className="space-y-4">
            {scheduleItems.map((item, index) => (
              <div key={index} className="grid grid-cols-1 md:grid-cols-6 gap-4 p-4 bg-white/5 rounded-xl border border-white/5 relative group">
                <div className="md:col-span-1 space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{t('trip_no')}</label>
                  <input name="trip_no" type="number" className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-2 text-sm" value={item.trip_no} onChange={(e) => handleScheduleChange(index, e)} />
                </div>
                <div className="md:col-span-1 space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{t('from')}</label>
                  <input name="from" placeholder="Place" className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-2 text-sm" value={item.from} onChange={(e) => handleScheduleChange(index, e)} />
                </div>
                <div className="md:col-span-1 space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{t('to')}</label>
                  <input name="to" placeholder="Place" className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-2 text-sm" value={item.to} onChange={(e) => handleScheduleChange(index, e)} />
                </div>
                <div className="md:col-span-1 space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{t('departure')}</label>
                  <input name="departure" placeholder="06:00 AM" className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-2 text-sm" value={item.departure} onChange={(e) => handleScheduleChange(index, e)} />
                </div>
                <div className="md:col-span-1 space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">{t('arrival')}</label>
                  <input name="arrival" placeholder="07:15 AM" className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-2 text-sm" value={item.arrival} onChange={(e) => handleScheduleChange(index, e)} />
                </div>
                <div className="md:col-span-1 flex items-end gap-2 pb-1">
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-[10px] font-bold text-slate-400 hover:text-white transition-colors">
                    <input type="checkbox" name="is_break" checked={item.is_break} onChange={(e) => handleScheduleChange(index, e)} className="rounded bg-slate-700 border-none text-blue-500 focus:ring-0" />
                    {t('is_break')}
                  </label>
                  <button type="button" onClick={() => removeScheduleItem(index)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                    <Trash2 size={16} />
                  </button>
                </div>
                {item.is_break && (
                  <div className="md:col-span-6 mt-2">
                    <input name="note" placeholder={t('note_lunch')} className="w-full bg-amber-500/5 border border-amber-500/20 rounded-lg px-4 py-2 text-sm text-amber-200 outline-none" value={item.note || ''} onChange={(e) => handleScheduleChange(index, e)} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>

        <div className="flex gap-4">
          <button type="submit" className="flex-1 btn-primary py-5 flex items-center justify-center gap-2 text-lg shadow-xl shadow-blue-500/20">
            <Save size={24} />
            {editingId ? t('sync_full_day') : t('launch_full_day')}
          </button>
          {editingId && (
            <button type="button" onClick={resetForm} className="px-8 py-5 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-all">
              {t('cancel_edit')}
            </button>
          )}
        </div>
      </form>

      {/* List Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-3">
          <MapPin className="text-blue-500" />
          {t('active_buses')}
        </h2>
        <div className="glass-card overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-900/50 border-b border-white/10">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">{t('bus_no')}</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">{t('route')}</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">{t('trips')}</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-slate-500">{t('actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {buses.map(bus => (
                    <tr key={bus._id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4 font-bold text-blue-400">{bus.bus_no}</td>
                      <td className="px-6 py-4 text-sm font-medium">{bus.start_place} → {bus.end_place}</td>
                      <td className="px-6 py-4">
                        <span className="bg-slate-800 px-2 py-1 rounded text-xs font-bold text-slate-300">
                          {bus.full_schedule?.length || 0} {t('events')}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <button onClick={() => handleEdit(bus)} className="p-2 bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white rounded-lg transition-all"><Edit2 size={16} /></button>
                          <button onClick={() => handleDelete(bus._id)} className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-all"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative glass-card border-white/10 max-w-md w-full p-8 shadow-2xl space-y-6"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className={`p-4 rounded-full ${confirmModal.type === 'danger' ? 'bg-red-500/20 text-red-500' : 'bg-emerald-500/20 text-emerald-500'}`}>
                  {confirmModal.type === 'danger' ? <AlertTriangle size={32} /> : <CheckCircle size={32} />}
                </div>
                <h3 className="text-2xl font-black">{confirmModal.title}</h3>
                <p className="text-slate-400 font-medium">{confirmModal.message}</p>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                  className="flex-1 px-6 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold transition-all"
                >
                  {t('cancel')}
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className={`flex-1 px-6 py-3 rounded-xl font-bold transition-all text-white ${confirmModal.type === 'danger' ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
                >
                  {t('confirm')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative glass-card border-white/10 max-w-md w-full p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-black flex items-center gap-2">
                  <Key className="text-blue-500" /> {t('security')}
                </h3>
                <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white"><X size={24} /></button>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('current_password')}</label>
                  <input 
                    type="password"
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
                    value={passwordForm.current}
                    onChange={(e) => setPasswordForm({...passwordForm, current: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('new_password')}</label>
                  <input 
                    type="password"
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
                    value={passwordForm.new}
                    onChange={(e) => setPasswordForm({...passwordForm, new: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{t('confirm_new_password')}</label>
                  <input 
                    type="password"
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none"
                    value={passwordForm.confirm}
                    onChange={(e) => setPasswordForm({...passwordForm, confirm: e.target.value})}
                    required
                  />
                </div>

                {passStatus.msg && (
                  <div className={`p-3 rounded-lg text-xs font-bold ${passStatus.type === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                    {passStatus.msg}
                  </div>
                )}

                <button type="submit" className="w-full btn-primary py-4 font-bold rounded-xl shadow-xl shadow-blue-500/20">
                  {t('update_password')}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Admin;
