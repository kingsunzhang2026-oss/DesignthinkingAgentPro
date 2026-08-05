import { createClient } from "@supabase/supabase-js";

const client = () => createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

export const set = async (key: string, value: any) => {
  const { error } = await client().from("kv_store_f477e18e").upsert({ key, value });
  if (error) throw new Error(error.message);
};

export const getByPrefix = async (prefix: string) => {
  const { data, error } = await client().from("kv_store_f477e18e").select("key, value").like("key", prefix + "%");
  if (error) throw new Error(error.message);
  return data?.map((d) => d.value) ?? [];
};
