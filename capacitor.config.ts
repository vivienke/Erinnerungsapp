import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'Erinnerungsapp',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  // App shortcuts are defined at runtime in shortcut.service.ts, where they are
  // registered together with their click listener — keeping a second copy here
  // would mean two sources of truth for the same shortcut.
};

export default config;
