import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'Erinnerungsapp',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    AppShortcuts: {
      shortcuts: [
        {
          id: 'new_reminder',
          title: 'Neue Erinnerung',
          description: 'Neue Erinnerung hinzufügen',
        },
      ],
    },
  },
};

export default config;
