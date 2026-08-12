// Koneksi ke Supabase.
const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY; 

let supabase = null;

if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
  console.warn(
    "SUPABASE_URL / SUPABASE_KEY belum diset di .env. Service Supabase belum bisa dipakai."
  );
}

function getClient() {
  if (!supabase) {
    throw new Error(
      "Supabase belum dikonfigurasi. Isi SUPABASE_URL dan SUPABASE_KEY di file .env."
    );
  }
  return supabase;
}

module.exports = { getClient };
