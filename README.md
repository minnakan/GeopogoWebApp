# GeopogoWebApp

WIP 3D web application using Three.js, Cesium Ion, Google Maps, TailwindCSS, and Vite.

## Setup

1. **Install dependencies**

   ```sh
   npm install
   # or
   pnpm install
   # or
   yarn install
   ```

2. **Create a `.env` file in the project root:**

   ```sh
   touch .env
   ```

   Add the following lines to `.env`:

   ```
   VITE_ION_KEY=your_cesium_ion_api_key_here
   VITE_GOOGLE_MAPS_KEY=your_google_maps_api_key_here
   ```

   - Get a Cesium Ion key: https://cesium.com/ion/
   - Get a Google Maps API key: https://console.cloud.google.com/apis/credentials

3. **Start the development server**

   ```sh
   npm run dev
   # or
   pnpm dev
   # or
   yarn dev
   ```

4. **Build for production**

   ```sh
   npm run build
   # or
   pnpm build
   # or
   yarn build
   ```

## License

MIT
