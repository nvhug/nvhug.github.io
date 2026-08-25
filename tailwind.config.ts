import type { Config } from "tailwindcss"

const config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Custom brand colors
        primary: {
          DEFAULT: '#a05b35',
          dark: '#8a4a2a',
          light: '#c7885c',
        },
        background: '#f7f4ed',
        text: {
          primary: '#171717',
          secondary: '#444',
          tertiary: '#999',
        },
        border: '#e5e0d5',
        card: '#fff',
        input: '#faf9f7',
      },
      fontFamily: {
        poppins: ['var(--font-poppins)', 'system-ui', 'sans-serif'],
        inter: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        playfair: ['var(--font-playfair)', 'Georgia', 'serif'],
        // Scoped to /tu-vi — see docs/DESIGN.md "Sổ Tử Vi" direction.
        'tuvi-serif': ['var(--font-tuvi-serif)', 'Georgia', 'serif'],
        'tuvi-sans': ['var(--font-tuvi-sans)', 'system-ui', 'sans-serif'],
        'tuvi-mono': ['var(--font-tuvi-mono)', 'monospace'],
      },
      fontSize: {
        '4.5xl': '48px',
        '3.5xl': '32px',
      },
    },
  },
  plugins: [],
} satisfies Config

export default config
