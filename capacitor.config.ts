import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config for the Resident mobile app.
 *
 * To build for iOS / Android locally:
 *   1. git pull your Lovable project to your machine
 *   2. bun install
 *   3. bun run build
 *   4. npx cap add ios     (one-time, on Mac with Xcode)
 *      npx cap add android (one-time, requires Android Studio)
 *   5. npx cap sync
 *   6. npx cap run ios     or  npx cap run android
 *
 * The `server.url` below makes the app hot-reload from the Lovable preview
 * so you can iterate without rebuilding. Remove it for production builds.
 */
const config: CapacitorConfig = {
  appId: 'app.lovable.hayyresident',
  appName: 'Hayy Resident',
  webDir: 'dist',
  server: {
    url: 'https://smarteagle.lovable.app?forceHideBadge=true',
    cleartext: true,
  },
};

export default config;
