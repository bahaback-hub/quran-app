import surahSecretData from './data/surah-secrets.json';

export const SURAH_SECRETS = surahSecretData.secrets as Record<number, string>;
export const SURAH_SECRETS_AUTH_KEYS = surahSecretData.authKeys as Record<number, string[]>;
