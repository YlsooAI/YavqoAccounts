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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { data } = await supabase
    .from("id_oauth_authorizations")
    .select("id, client_id, id_oauth_clients(backchannel_logout_uri)")
    .eq("user_id", user.id);

  const rows = (data as AuthorizationWithClient[] | null) ?? [];
  const issuer = getOAuthIssuer(request.url);

  await Promise.allSettled(
    rows.map((row) => {
      const clientMeta = Array.isArray(row.id_oauth_clients)
        ? row.id_oauth_clients[0]
        : row.id_oauth_clients;
      const uri = clientMeta?.backchannel_logout_uri;
      if (!uri) return Promise.resolve();
      return dispatchBackchannelLogout({
        uri,
        issuer,
        clientId: row.client_id,
        userId: user.id,
        authorizationId: row.id,
      });
    })
  );

  return NextResponse.json({ ok: true });
}
