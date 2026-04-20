import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BUCKET = 'kingdom-assets';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function fail(message: string, status = 400) {
  return json({ ok: false, error: message }, status);
}

function checkPassword(password: unknown) {
  const expected = Deno.env.get('KINGDOM_EDIT_PASSWORD') || '';
  return Boolean(expected) && typeof password === 'string' && password === expected;
}

function safeSegment(value: unknown, fallback = 'asset') {
  return String(value || fallback)
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || fallback;
}

function extensionFromMime(mime = '') {
  if (mime.includes('svg')) return 'svg';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  return 'png';
}

function decodeDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!match) throw new Error('Invalid dataUrl');
  const mime = match[1];
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return { bytes, mime };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return fail('Method not allowed', 405);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail('Invalid JSON', 400);
  }

  if (!checkPassword(body.password)) return fail('Mot de passe incorrect', 401);
  if (body.action === 'verify') return json({ ok: true });

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return fail('Supabase secrets missing', 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  const projectId = safeSegment(body.projectId || 'main', 'main');

  if (body.action === 'load-project') {
    const { data: project, error: projectError } = await supabase
      .from('kr_projects')
      .select('payload,updated_at')
      .eq('id', projectId)
      .maybeSingle();

    if (projectError) return fail(projectError.message, 500);

    const { data: assets, error: assetsError } = await supabase
      .from('kr_assets')
      .select('*')
      .eq('project_id', projectId);

    if (assetsError) return fail(assetsError.message, 500);

    return json({
      ok: true,
      payload: project?.payload ?? null,
      updatedAt: project?.updated_at ?? null,
      assets: assets ?? [],
    });
  }

  if (body.action !== 'save-project') return fail('Unknown action', 400);

  const payload = body.payload && typeof body.payload === 'object' ? body.payload : null;
  if (!payload) return fail('Missing payload', 400);

  const now = new Date().toISOString();
  const { error: projectError } = await supabase
    .from('kr_projects')
    .upsert({ id: projectId, name: body.name || 'Kingdom Reforged', payload, updated_at: now });

  if (projectError) return fail(projectError.message, 500);

  const assets = Array.isArray(body.assets) ? body.assets : [];
  for (const asset of assets) {
    if (!asset?.dataUrl || !asset?.id || !asset?.kind) continue;
    if (asset.kind !== 'image' && asset.kind !== 'icon') continue;

    let decoded;
    try {
      decoded = decodeDataUrl(asset.dataUrl);
    } catch {
      continue;
    }

    const assetId = safeSegment(asset.id);
    const ext = extensionFromMime(decoded.mime);
    const storagePath = `${projectId}/${asset.kind}s/${assetId}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, decoded.bytes, {
        contentType: decoded.mime,
        upsert: true,
      });

    if (uploadError) return fail(uploadError.message, 500);

    const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const { error: assetError } = await supabase.from('kr_assets').upsert({
      project_id: projectId,
      kind: asset.kind,
      asset_id: assetId,
      name: asset.name || assetId,
      category: asset.category || null,
      storage_path: storagePath,
      public_url: publicData.publicUrl,
      mime_type: decoded.mime,
      size_bytes: decoded.bytes.byteLength,
      updated_at: now,
    });

    if (assetError) return fail(assetError.message, 500);
  }

  return json({ ok: true, updatedAt: now, assetCount: assets.length });
});
