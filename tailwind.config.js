/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        background: "#151718",
        foreground: "#ECEDEE",
        tint: "#fff",
        icon: "#9BA1A6",
      },
      fontFamily: {
        rounded: ["ui-rounded", "SF Pro Rounded", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
