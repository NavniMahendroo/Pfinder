import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
      },
      borderRadius: {
        xl: "24px",
      },
      colors: {
        glass: "rgba(255,255,255,0.14)",
      },
      boxShadow: {
        glow: "0 18px 50px rgba(26, 92, 255, 0.25)",
      },
      backgroundImage: {
        mesh: "radial-gradient(circle at 12% 10%, #fde68a 0%, transparent 40%), radial-gradient(circle at 86% 22%, #7dd3fc 0%, transparent 30%), radial-gradient(circle at 55% 85%, #fdba74 0%, transparent 40%)",
      },
    },
  },
  plugins: [],
};

export default config;
