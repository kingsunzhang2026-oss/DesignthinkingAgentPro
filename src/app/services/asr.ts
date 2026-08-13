import { projectId, publicAnonKey } from '../utils/supabase/info';
import { supabase } from '../utils/supabase/client';

/**
 * 调用 asr-proxy Edge Function，将已上传到 Supabase Storage 的音频公开 URL 转为文字。
 * 凭证（ASR_APP_ID / ASR_ACCESS_KEY）只在 Edge Function 的 Secrets 中，前端不持有。
 */
export async function transcribeAudio(audioUrl: string, language = 'zh-CN'): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  const base = `https://${projectId}.supabase.co/functions/v1/asr-proxy/transcribe`;
  const res = await fetch(base, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': publicAnonKey,
      'Authorization': `Bearer ${session?.access_token || publicAnonKey}`,
    },
    body: JSON.stringify({ audioUrl, language }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'transcribe failed');
  return json.transcript || '';
}
