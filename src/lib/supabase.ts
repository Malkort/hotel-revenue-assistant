import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ID отеля по умолчанию (единственный в MVP)
export const DEFAULT_HOTEL_ID = 'a1b2c3d4-0000-0000-0000-000000000001';
