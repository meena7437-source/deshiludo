import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getFirebaseAdminAuth } from "../../../lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Login token nahi mila." },
        { status: 401 }
      );
    }

    const idToken = authorization.substring(7).trim();

    if (!idToken) {
      return NextResponse.json(
        { error: "Login token khali hai." },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      throw new Error("NEXT_PUBLIC_SUPABASE_URL missing hai.");
    }

    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY missing hai.");
    }

    const firebaseAdminAuth = getFirebaseAdminAuth();
    const decodedToken = await firebaseAdminAuth.verifyIdToken(idToken);
    const verifiedUid = decodedToken.uid;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

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