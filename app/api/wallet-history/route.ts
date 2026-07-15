import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FirebaseLookupResponse = {
  users?: Array<{
    localId?: string;
  }>;
  error?: {
    message?: string;
  };
};

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Login token nahi mila." },
        { status: 401 }
      );
    }

    const idToken = authorization.slice(7).trim();

    if (!idToken) {
      return NextResponse.json(
        { error: "Login token khali hai." },
        { status: 401 }
      );
    }

    const firebaseWebApiKey = process.env.FIREBASE_WEB_API_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!firebaseWebApiKey) {
      throw new Error("FIREBASE_WEB_API_KEY missing hai.");
    }

    if (!supabaseUrl) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL missing hai.");
    }

    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY missing hai.");
    }

    const firebaseResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
        firebaseWebApiKey
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          idToken,
        }),
        cache: "no-store",
      }
    );

    const firebaseResult =
      (await firebaseResponse.json()) as FirebaseLookupResponse;

    if (!firebaseResponse.ok) {
      return NextResponse.json(
        {
          error: "Firebase login token verify nahi hua.",
          details:
            firebaseResult.error?.message ||
            `Firebase verification failed: ${firebaseResponse.status}`,
        },
        { status: 401 }
      );
    }

    const verifiedUid = firebaseResult.users?.[0]?.localId;

    if (!verifiedUid) {
      return NextResponse.json(
        {
          error: "Verified Firebase UID nahi mili.",
        },
        { status: 401 }
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    );

    const { data, error } = await supabaseAdmin
      .from("wallet_history")
      .select(
        "id,uid,type,title,amount,direction,balance_type,reference_id,created_at"
      )
      .eq("uid", verifiedUid)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json(
        {
          error: "Wallet history database se load nahi hui.",
          details: error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        uid: verifiedUid,
        history: data || [],
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown server error";

    return NextResponse.json(
      {
        error: "Wallet history API error.",
        details: message,
      },
      { status: 500 }
    );
  }
}