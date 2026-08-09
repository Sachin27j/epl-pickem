import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';

if (!process.env.JWT_SECRET && existsSync('.env')) {
  loadEnvFile();
}

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
