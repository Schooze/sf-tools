/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#121214',
        sidebar: '#18181b',
        surface: {
          DEFAULT: '#1f1f23',
          hover: '#27272b',
          active: '#2e2e33',
          elevated: '#232328',
        },
        border: 'rgba(255, 255, 255, 0.08)',
        borderHover: 'rgba(255, 255, 255, 0.15)',
        sf: {
          accent: '#3b82f6',
          accentHover: '#2563eb',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',
          text: '#f4f4f5',
          muted: '#a1a1aa',
          subtle: '#71717a',
        },
      },
      fontFamily: {
        sans: [
          'Geist',
          'Inter',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'Fira Code', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '14px',
      },
    },
  },
  plugins: [],
};
