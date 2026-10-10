import 'react-native-url-polyfill/auto';
import { createClient, processLock } from '@supabase/supabase-js';
import { secureStorage } from './storage';
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const configured = !!url && !!key && !url.includes('YOUR_PROJECT') && !key.includes('YOUR_');
export const supabase = configured ? createClient(url!, key!, {
  auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false, lock: processLock },
}) : null;
