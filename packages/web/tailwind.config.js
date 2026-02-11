/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        vinyl: {
          bg: '#000000',
          surface: '#0a0a0a',
          border: '#1a1a1a',
          muted: '#666666',
          accent: '#8b5cf6',
        },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'],
        lyrics: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
    },
  },
  plugins: [],
};
