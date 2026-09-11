import { createClient } from "@supabase/supabase-js"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

const missingVars = [
  !supabaseUrl && "VITE_SUPABASE_URL",
  !supabasePublishableKey && "VITE_SUPABASE_PUBLISHABLE_KEY",
].filter(Boolean)

export const supabaseConfigError = missingVars.length
  ? `Faltan variables de entorno: ${missingVars.join(", ")}.`
  : null

export const supabase = supabaseConfigError
  ? null
  : createClient(supabaseUrl, supabasePublishableKey)
