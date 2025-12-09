/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			colors: {
				hermetic: {
					emerald: '#013529',
					forest: '#054F2E',
					sulfur: '#E88624',
					gold: '#C5A059',
					void: '#0a0a0a',
					white: '#FBFBFB',
				}
			},
			fontFamily: {
				serif: ['"Cinzel"', 'serif'],
				sans: ['"Lato"', 'sans-serif'],
			},
			boxShadow: {
				'flame-glow': '0 0 35px rgba(232, 134, 36, 0.5), inset 0 0 10px rgba(232, 134, 36, 0.2)',
				'gold-halo': '0 0 50px rgba(197, 160, 89, 0.15)',
				'deep-glass': '0 20px 50px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(197, 160, 89, 0.1)',
			},
			backgroundImage: {
				'velvet-gradient': 'radial-gradient(circle at 50% 30%, rgba(5, 79, 46, 0.25) 0%, rgba(1, 53, 41, 0.95) 70%, #000000 100%)',
			},
			animation: {
				'star-float': 'star-float 100s linear infinite',
				'pulse-fog': 'pulse-fog 10s ease-in-out infinite alternate',
				'levitate-slow': 'levitate 6s ease-in-out infinite',
				'levitate-delayed': 'levitate 7s ease-in-out infinite 1s',
			},
			keyframes: {
				'star-float': {
					'from': { transform: 'translateY(0)' },
					'to': { transform: 'translateY(-50%)' },
				},
				'pulse-fog': {
					'from': { opacity: '0.3', transform: 'scale(1)' },
					'to': { opacity: '0.6', transform: 'scale(1.1)' },
				},
				levitate: {
					'0%, 100%': { transform: 'translateY(0)' },
					'50%': { transform: 'translateY(-15px)' },
				}
			}
		},
	},
	plugins: [],
}