const crypto = require("crypto");
const { getClient } = require("../config/supabase");

const SESSION_TTL_MS = 1000 * 60 * 60 * 24; // 24 jam

async function createSession(userId) {
  const supabase = getClient();
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();

  const { error } = await supabase
    .from("sessions")
    .insert({ token, user_id: userId, expires_at: expiresAt });

  if (error) throw error;
  return token;
}

async function getSession(token) {
  if (!token) return null;
  const supabase = getClient();

  const { data, error } = await supabase
    .from("sessions")
    .select("*, users:user_id(id, telegram_chat_id, name)")
    .eq("token", token)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  if (new Date(data.expires_at) < new Date()) {
    await deleteSession(token);
    return null;
  }

  return data;
}

async function deleteSession(token) {
  const supabase = getClient();
  await supabase.from("sessions").delete().eq("token", token);
}

module.exports = { createSession, getSession, deleteSession };
