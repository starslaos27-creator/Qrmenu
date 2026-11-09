import { createClient } from "@supabase/supabase-js";
export function createSupabaseClients(env) {
    if (!env.supabaseUrl || !env.supabaseAnonKey) {
        return { anon: null, admin: null };
    }
    return {
        anon: createClient(env.supabaseUrl, env.supabaseAnonKey, {
            auth: { persistSession: false },
        }),
        admin: env.supabaseServiceRoleKey
            ? createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
                auth: { persistSession: false },
            })
            : null,
    };
}
