import { NextResponse } from 'next/server';

// Read-only summary for the Command Center. The link carries its own secret token;
// the database function checks it and returns counts and short lists only. No login cookie, so
// middleware lets this path through.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token')?.trim() ?? '';
  if (!token) return new NextResponse('Missing token', { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const res = await fetch(`${url}/rest/v1/rpc/command_center_summary`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
    cache: 'no-store',
  });
  if (!res.ok) return new NextResponse('Not allowed', { status: res.status === 400 ? 401 : 502 });
  return NextResponse.json(await res.json(), { headers: { 'Cache-Control': 'no-store' } });
}
