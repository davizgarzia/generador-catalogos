import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey)

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null

export function getCatalogImageUrl(path) {
  if (!path || !supabase) return path
  if (/^https?:\/\//.test(path)) return path

  return supabase.storage.from("catalog-images").getPublicUrl(path).data.publicUrl
}
