#!/usr/bin/env bash
# =============================================================
# tripo3d-proxy Edge Function 部署助手
#
# 用法:
#   ./deploy-tripo3d-proxy.sh            # 部署（CLI 可用时走 CLI，否则打印控制台粘贴指引）
#   ./deploy-tripo3d-proxy.sh --check    # 只做线上健康检查（不消耗 Tripo credit）
#
# 说明:
#   - 项目 ref: sgxkplfbptwdohjjnlzd
#   - CLI 部署需要 SUPABASE_ACCESS_TOKEN（Supabase 控制台 → Account → Access Tokens 生成）
#   - 无 token 时走"控制台粘贴"路线：dashboard 打开函数 → 全选替换 index.ts 内容 → Deploy
# =============================================================
set -euo pipefail

FN="tripo3d-proxy"
REF="sgxkplfbptwdohjjnlzd"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/supabase/functions/$FN/index.ts"
FUNC_URL="https://sgxkplfbptwdohjjnlzd.supabase.co/functions/v1/$FN"
DASH_URL="https://supabase.com/dashboard/project/$REF/functions/$FN/details"

# ---------- --check 模式：健康检查 ----------
if [[ "${1:-}" == "--check" ]]; then
  echo ">>> 线上健康检查: $FUNC_URL"
  resp=$(curl -s --max-time 12 "$FUNC_URL" || true)
  echo "$resp"
  if echo "$resp" | grep -q '"ok":true'; then
    echo ">>> ✅ 函数在线，TRIPO_API_KEY 已设置"
    exit 0
  fi
  echo ">>> ❌ 函数异常或不可达，请到控制台查看日志: $DASH_URL"
  exit 1
fi

# ---------- 部署模式 ----------
[[ -f "$SRC" ]] || { echo "❌ 找不到 $SRC"; exit 1; }
echo ">>> 源文件: $SRC ($(wc -l < "$SRC" | tr -d ' ') 行)"

# 校验本地代码是修复版（官方顺序 front,left,back,right）
if grep -q '"front", "left", "back", "right"' "$SRC"; then
  echo ">>> ✅ 本地代码含 multiview 顺序修复 [front, left, back, right]"
else
  echo ">>> ⚠️ 未检测到顺序修复特征串，请先确认代码版本！"
  exit 1
fi

if command -v supabase >/dev/null 2>&1; then
  echo ">>> 检测到 supabase CLI，开始部署..."
  if [[ -n "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
    (cd "$ROOT/supabase" && supabase functions deploy "$FN" --project-ref "$REF" --use-api)
    echo ">>> ✅ 部署完成，稍候 30 秒后可执行 $0 --check 验证"
  else
    echo ">>> ❌ CLI 已安装但缺少 SUPABASE_ACCESS_TOKEN"
    echo "    导出后重试:  export SUPABASE_ACCESS_TOKEN=sbp_xxx"
    echo "    (Supabase 控制台 → 头像 → Access Tokens → Generate new token)"
    exit 1
  fi
else
  cat <<EOF
>>> 未安装 supabase CLI，走【控制台粘贴】路线（约 2 分钟）：

  1. 打开函数详情页: $DASH_URL
  2. 点右上角「Edit / 编辑」进入代码编辑器
  3. 全选删除编辑器内容，把下面这个文件的全文粘贴进去:
     $SRC
  4. 点「Deploy」保存发布
  5. 部署完成后执行:  $0 --check   （应输出 {"ok":true,...}）

  （如想走 CLI：brew install supabase/tap/supabase 后重跑本脚本）
EOF
fi
