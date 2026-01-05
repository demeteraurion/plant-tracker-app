import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mwgmbzgiccebumhxgaef.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13Z21iemdpY2NlYnVtaHhnYWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc1ODYyNzcsImV4cCI6MjA4MzE2MjI3N30.iGZR2OqwuzPSsGhDhJ844YlTl24-Zs9PkoLGnlDf4Ms';

// anon key is safe in the browser, but don't commit it to a public repo.
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
