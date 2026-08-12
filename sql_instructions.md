-- 在您的 Supabase 新项目中打开 SQL Editor，执行以下代码以创建存储桶
insert into storage.buckets (id, name, public) 
values ('audio-records', 'audio-records', false);

-- 创建允许所有登录用户上传和读取录音的策略
create policy "Enable all for authenticated users"
on storage.objects for all
to authenticated
using ( bucket_id = 'audio-records' );
