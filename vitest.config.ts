import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Zona horaria fija: las pruebas de fechas locales son deterministas.
    env: { TZ: 'America/Bogota' },
  },
});
