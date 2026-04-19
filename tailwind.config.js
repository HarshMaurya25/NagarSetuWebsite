/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Core surfaces
        "on-surface": "#151c23",
        "surface-container-lowest": "#ffffff",
        surface: "#f6f9ff",
        "surface-container-low": "#edf4fd",
        "surface-container": "#e7eff7",
        "surface-container-high": "#e2e9f2",
        "surface-container-highest": "#dce3ec",
        background: "#f6f9ff",

        // Brand + accents
        primary: "#1a365d", // Nagar Setu navy
        "primary-container": "#1e40af",
        secondary: "#2563eb",
        "secondary-container": "#2170e4",
        tertiary: "#18355a",
        "tertiary-container": "#314c72",

        // Text + outlines
        outline: "#757684",
        "outline-variant": "#c4c5d5",
        "on-primary": "#ffffff",
        "on-secondary": "#ffffff",
        "on-tertiary": "#ffffff",
        "on-surface-variant": "#444653",
        "on-background": "#151c23",

        // Status
        error: "#ba1a1a",
        "error-container": "#ffdad6",
        "on-error": "#ffffff",
        "on-error-container": "#93000a",

        // Keep legacy tokens used in generated pages
        "surface-tint": "#3755c3",
        "inverse-surface": "#2a3138",
        "inverse-on-surface": "#eaf1fa",
        "inverse-primary": "#b8c4ff",
        "primary-fixed": "#dde1ff",
        "primary-fixed-dim": "#b8c4ff",
        "on-primary-fixed": "#001453",
        "on-primary-fixed-variant": "#173bab",
        "secondary-fixed": "#d8e2ff",
        "secondary-fixed-dim": "#adc6ff",
        "on-secondary-fixed": "#001a42",
        "on-secondary-fixed-variant": "#004395",
        "tertiary-fixed": "#d5e3ff",
        "tertiary-fixed-dim": "#adc8f5",
        "on-tertiary-fixed": "#001c3b",
        "on-tertiary-fixed-variant": "#2d486d",
        "surface-dim": "#d4dbe3",
        "surface-bright": "#f6f9ff",
        "surface-variant": "#dce3ec",
        "on-secondary-container": "#fefcff",
        "on-tertiary-container": "#a2bde9",
        "on-primary-container": "#a8b8ff",
      },
      borderRadius: {
        // Larger radii for a bento / SaaS look
        DEFAULT: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        full: "9999px",
      },
      fontFamily: {
        headline: ["Public Sans", "Inter", "Roboto", "sans-serif"],
        body: ["Inter", "Roboto", "sans-serif"],
        label: ["Inter", "Roboto", "sans-serif"],
      },
      boxShadow: {
        elevated:
          "0 4px 6px -1px rgb(0 0 0 / 0.10), 0 2px 4px -2px rgb(0 0 0 / 0.10)",
      },
      backgroundImage: {
        "gradient-primary": "linear-gradient(135deg, #1a365d 0%, #1e40af 100%)",
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
    require("@tailwindcss/container-queries"),
  ],
};
