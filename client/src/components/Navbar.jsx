import { Link } from 'react-router-dom';
import { Search, Bell, Globe } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const Navbar = () => {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ta' : 'en';
    i18n.changeLanguage(newLang);
    localStorage.setItem('appLanguage', newLang);
  };

  return (
    <nav className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-white/10">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3">
          <motion.div 
            whileHover={{ scale: 1.1, rotate: 8 }}
            whileTap={{ scale: 0.9 }}
            className="flex items-center justify-center"
          >
            <img 
              src="/favicon.svg" 
              alt="TNSTC BusTracker Logo" 
              className="w-10 h-10 object-contain drop-shadow-[0_4px_12px_rgba(59,130,246,0.45)]" 
            />
          </motion.div>
          <span className="text-xl font-bold bg-gradient-to-r from-blue-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent tracking-tight">
            {t('app_title')}
          </span>
        </Link>

        <div className="hidden md:flex items-center space-x-8">
          <Link to="/" className="text-slate-300 hover:text-white transition-colors">{t('find_bus')}</Link>
          <Link to="/admin" className="text-slate-300 hover:text-white transition-colors">{t('admin_panel')}</Link>
        </div>

        <div className="flex items-center space-x-4">
          <button 
            onClick={toggleLanguage}
            className="flex items-center gap-1 p-2 text-slate-400 hover:text-white transition-colors"
            title="Translate (English / Tamil)"
          >
            <Globe size={20} />
            <span className="text-xs font-bold uppercase">{i18n.language}</span>
          </button>
          <button className="p-2 text-slate-400 hover:text-white transition-colors">
            <Bell size={20} />
          </button>
          <button className="md:hidden p-2 text-slate-400 hover:text-white transition-colors">
            <Search size={20} />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
