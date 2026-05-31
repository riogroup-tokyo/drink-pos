// ════════════════════════════════════════════════════════════════
//  リアルタイム同期設定（Supabase）
//  下の2つに、Supabaseの「Project URL」と「anon public key」を貼ってください。
//  未入力のうちは、今まで通り各端末ローカルだけで動きます（同期オフ）。
// ════════════════════════════════════════════════════════════════
const SUPABASE_URL      = "https://dfzsicybwemyxiesxlah.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_il0mkrGNw5I6pnrmhSLk7g_nVwaQk1T";
const ROOM              = "rio-pos";   // 合言葉。全端末で同じ値（変えると別集計になります）
// ════════════════════════════════════════════════════════════════

const rowOf = d => (Array.isArray(d) ? d[0] : d) || null;
const CONFIGURED =
  SUPABASE_URL && !SUPABASE_URL.startsWith("__") &&
  SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.startsWith("__");

export function startSync({ fields, cacheKey, onChange, onStatus }) {
  const server = {};                        // サーバ上の確定値
  fields.forEach(f => server[f] = 0);
  try { Object.assign(server, JSON.parse(localStorage.getItem(cacheKey)) || {}); } catch (e) {}

  const pending = [];                        // 未送信の±（オフライン耐性）
  let supa = null, ready = false, flushing = false;

  const status = s => onStatus && onStatus(s);

  function recompute(){                       // 表示 = サーバ確定値 ＋ 未送信ぶん
    const disp = {};
    fields.forEach(f => disp[f] = server[f] || 0);
    for (const p of pending) disp[p.field] = Math.max(0, (disp[p.field] || 0) + p.delta);
    onChange(disp);
    try { localStorage.setItem(cacheKey, JSON.stringify(disp)); } catch (e) {}
  }
  function setServer(row){
    if (!row) return;
    fields.forEach(f => { if (typeof row[f] === "number") server[f] = row[f]; });
  }

  recompute();                               // キャッシュから即描画（オフラインでも即使える）

  async function flush(){
    if (!supa || !ready || flushing) return;
    flushing = true;
    try {
      while (pending.length){
        const job = pending[0];
        const { data, error } = await supa.rpc("bump", { p_room: ROOM, p_field: job.field, p_delta: job.delta });
        if (error){ status("offline"); return; }   // 失敗→キューに残し後で再送
        pending.shift();
        setServer(rowOf(data));
        recompute();
      }
      status("online");
    } finally { flushing = false; }
  }

  if (CONFIGURED){
    status("connecting");
    (async () => {
      try {
        const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
        supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        ready = true;
        const { data } = await supa.from("counters").select("*").eq("room", ROOM).maybeSingle();
        setServer(data); recompute();
        supa.channel("counters-" + ROOM)
          .on("postgres_changes",
              { event: "*", schema: "public", table: "counters", filter: `room=eq.${ROOM}` },
              payload => { setServer(payload.new); recompute(); })
          .subscribe(st => {
            if (st === "SUBSCRIBED") status(pending.length ? "connecting" : "online");
            else if (st === "CHANNEL_ERROR" || st === "TIMED_OUT" || st === "CLOSED") status("offline");
          });
        flush();
      } catch (e){ status("offline"); }
    })();
    setInterval(flush, 4000);                 // オフライン復帰時の自動再送
  } else {
    status("local");
  }

  function bump(field, delta){
    if (!CONFIGURED){                          // 同期オフ：ローカルのみ
      server[field] = Math.max(0, (server[field] || 0) + delta);
      recompute();
      return;
    }
    pending.push({ field, delta });            // 同期オン：楽観更新→サーバ加算
    recompute();
    flush();
  }

  async function reset(){
    pending.length = 0;
    fields.forEach(f => server[f] = 0);
    recompute();
    if (supa && ready){
      try {
        const { data } = await supa.rpc("reset_fields", { p_room: ROOM, p_fields: fields });
        setServer(rowOf(data)); recompute();
      } catch (e){ status("offline"); }
    }
  }

  return { bump, reset };
}
