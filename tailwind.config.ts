import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
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
