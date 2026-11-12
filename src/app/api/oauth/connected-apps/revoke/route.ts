import { NextRequest, NextResponse } from "next/server";
import { getOAuthIssuer } from "@/lib/oauth";
import { dispatchBackchannelLogout } from "@/lib/oauth-backchannel";
import { createClient } from "@/lib/supabase/server";

type AuthorizationWithClient = {
  id: string;
  client_id: string;
  id_oauth_clients:
    | { backchannel_logout_uri?: string | null }
    | Array<{ backchannel_logout_uri?: string | null }>
    | null;
};

export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== request.nextUrl.origin) {
    return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  }

  let body: { authorizationId?: string };
  try {
    body = (await request.json()) as { authorizationId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const authorizationId = body.authorizationId;
  if (
    !authorizationId ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      authorizationId
    )
  ) {
    return NextResponse.json({ error: "Invalid authorizationId." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data: existing, error: fetchError } = await supabase
    .from("id_oauth_authorizations")
    .select("id, client_id, id_oauth_clients(backchannel_logout_uri)")
    .eq("id", authorizationId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }
  if (!existing) {
    return NextResponse.json({ error: "Authorization not found." }, { status: 404 });
  }

  const { error: deleteError } = await supabase
    .from("id_oauth_authorizations")
    .delete()
    .eq("id", authorizationId)
    .eq("user_id", user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const row = existing as AuthorizationWithClient;
  const clientMeta = Array.isArray(row.id_oauth_clients)
    ? row.id_oauth_clients[0]
    : row.id_oauth_clients;
  const backchannelUri = clientMeta?.backchannel_logout_uri ?? null;

  let backchannelNotified = false;
  if (backchannelUri) {
    const result = await dispatchBackchannelLogout({
      uri: backchannelUri,
      issuer: getOAuthIssuer(request.url),
      clientId: row.client_id,
      userId: user.id,
      authorizationId: row.id,
    });
    backchannelNotified = result.ok;
  }

  return NextResponse.json({ ok: true, backchannelNotified });
}
