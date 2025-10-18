import React, { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCode, FiSettings, FiBook, FiSun, FiMoon, FiMenu, FiX } from 'react-icons/fi';
import { useSocket } from '../../hooks/useSocket.js';

const NavLinkItem = ({ to, children, onClick }) => (
  <NavLink
    to={to}
    onClick={onClick}
    className={({ isActive }) =>
      `text-lg font-medium transition-colors duration-300 ${isActive ? 'text-indigo-400' : 'text-gray-300 hover:text-indigo-400'}`
    }
  >
    {children}
  </NavLink>
);

function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const savedTheme = localStorage.getItem('baseline-settings') ? JSON.parse(localStorage.getItem('baseline-settings')).theme : 'dark';
    setTheme(savedTheme);
    document.documentElement.classList.toggle('dark', savedTheme === 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    const settings = JSON.parse(localStorage.getItem('baseline-settings') || '{}');
    settings.theme = newTheme;
    localStorage.setItem('baseline-settings', JSON.stringify(settings));
    document.documentElement.classList.toggle('dark', newTheme === 'dark');
  };

  const navLinks = (
    <>
      <NavLinkItem to="/scan" onClick={() => setIsMenuOpen(false)}>New Scan</NavLinkItem>
      <NavLinkItem to="/docs" onClick={() => setIsMenuOpen(false)}>Docs</NavLinkItem>
      <NavLinkItem to="/settings" onClick={() => setIsMenuOpen(false)}>Settings</NavLinkItem>
    </>
  );

  return (
    <header data-testid="main-header" className="bg-gray-900/80 backdrop-blur-lg sticky top-0 z-50 shadow-lg shadow-indigo-500/10">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <Link to="/" className="flex items-center space-x-3 group">
            <motion.div whileHover={{ rotate: 360, scale: 1.1 }} transition={{ duration: 0.5 }}>
              <FiCode className="w-8 h-8 text-indigo-500 group-hover:text-indigo-400 transition-colors duration-300" />
            </motion.div>
            <h1 className="text-2xl font-bold text-white group-hover:text-indigo-400 transition-colors duration-300">
              Baseline Autopilot
            </h1>
          </Link>

          <nav className="hidden md:flex items-center space-x-8">
            {navLinks}
          </nav>

          <div className="flex items-center space-x-4">

            <motion.button
              onClick={toggleTheme}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 rounded-full bg-gray-800/50 hover:bg-indigo-500/20 transition-colors duration-300"
            >
              {theme === 'dark' ? <FiSun className="w-6 h-6 text-yellow-400" /> : <FiMoon className="w-6 h-6 text-indigo-400" />}
            </motion.button>

            <div className="md:hidden">
              <motion.button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-full bg-gray-800/50 hover:bg-indigo-500/20 transition-colors duration-300"
              >
                {isMenuOpen ? <FiX className="w-6 h-6 text-indigo-400" /> : <FiMenu className="w-6 h-6 text-indigo-400" />}
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="md:hidden bg-gray-900/90 backdrop-blur-lg absolute top-20 left-0 right-0 shadow-lg"
          >
            <nav className="flex flex-col items-center space-y-6 py-8">
              {navLinks}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default Header;