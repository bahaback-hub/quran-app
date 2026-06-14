/**
 * Vitest setup file — initializes i18n with Arabic before tests run.
 * This ensures __() returns proper Arabic translations at test time,
 * since config.ts and other modules now use __() at module level.
 */
import { setLang } from '../i18n.js';

await setLang('ar');
