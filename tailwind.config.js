/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0f1115",
        panel: "#161a22",
        panel2: "#1c2230",
        border: "#272f3d",
        muted: "#8a93a6",
        text: "#e6ebf2",
        accent: "#5b8cff",
        reply: "#ef4444",
        important: "#eab308",
        event: "#3b82f6",
        noise: "#6b7280",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Inter",
          "Segoe UI",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
