import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      animation: {
        fadeUpIn: 'fadeUpIn 0.6s ease-out forwards',
        'pulse-ring': 'pulseRing 2s infinite',
        'pulse-dot': 'pulseDot 1.5s infinite',
      },
      keyframes: {
        fadeUpIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseRing: {
          '0%': { boxShadow: '0 0 0 0 rgba(249, 115, 22, 0.7)' },
          '70%': { boxShadow: '0 0 0 6px rgba(249, 115, 22, 0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(249, 115, 22, 0)' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.2)' },
        },
      },
      colors: {
        primary: {
          DEFAULT: '#1a1a2e',
          dark: '#0f0f1e',
          light: '#25254a',
        },
        accent: {
          DEFAULT: '#e67e22',
          dark: '#d35400',
          light: '#f39c12',
        },
        warning: {
          DEFAULT: '#f39c12',
          dark: '#d68910',
          light: '#f7dc6f',
        },
        danger: {
          DEFAULT: '#e74c3c',
          dark: '#c0392b',
          light: '#ec7063',
        },
        success: {
          DEFAULT: '#27ae60',
          dark: '#1e8449',
          light: '#52be80',
        },
        neutral: {
          DEFAULT: '#ecf0f1',
          dark: '#bdc3c7',
          light: '#f8f9f9',
        },
      },
    },
  },
  plugins: [],
};

export default config;
