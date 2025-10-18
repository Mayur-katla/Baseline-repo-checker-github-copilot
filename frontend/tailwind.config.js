import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import aspectRatio from '@tailwindcss/aspect-ratio';
import containerQueries from '@tailwindcss/container-queries';

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '1rem',
        sm: '1.5rem',
        lg: '2rem',
      },
    },
    extend: {
      colors: {
        // New Modern Color Palette
        primary: {
          DEFAULT: '#4A90E2',
          light: '#7BB9F2',
          dark: '#2E67A4',
        },
        secondary: {
          DEFAULT: '#50E3C2',
          light: '#81E9D1',
          dark: '#29A38A',
        },
        accent: {
          DEFAULT: '#F5A623',
          light: '#F7C163',
          dark: '#B87E1A',
        },
        success: '#7ED321',
        warning: '#F8E71C',
        danger: '#D0021B',
        info: '#4A90E2',
        muted: '#9B9B9B',
        
        // Grayscale
        gray: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
        },
      },

      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },

      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #4A90E2, #50E3C2)',
        'glass': 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0))',
      },

      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-in-out',
        'subtle-pulse': 'subtlePulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },

      keyframes: {
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        subtlePulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '.5' },
        },
      },

      boxShadow: {
        'glass': '0 4px 30px rgba(0, 0, 0, 0.1)',
        'card': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
      },

      backdropBlur: {
        'xl': '24px',
      },

      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
      },
    },
  },
  plugins: [
    forms,
    typography,
    aspectRatio,
    containerQueries,
  ],
};
