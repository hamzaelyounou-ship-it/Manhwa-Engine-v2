module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        'dark-fantasy-900': '#0b0f12',
        'dark-fantasy-800': '#0f1518',
        'dark-fantasy-700': '#13181b',
        'dark-fantasy-600': '#1b2428',
        'accent-ember': '#ff6b4a',
        'accent-myst': '#8be6c1'
      },
      fontFamily: {
        display: ['Inter', 'ui-sans-serif', 'system-ui']
      }
    }
  },
  plugins: []
}
