import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { username, password } = await request.json();

  const cleanUsername = String(username || "").trim();
  const cleanPassword = String(password || "").trim();

  if (cleanUsername !== "admin" || cleanPassword !== "admin123") {
    return NextResponse.json(
      {
        success: false,
        message: `DEBUG: username=${cleanUsername}, password=${cleanPassword}`,
      },
      { status: 401 }
    );
  }

  const response = NextResponse.json({
    success: true,
    message: "Admin login successful",
  });

  response.cookies.set("deshiludo_admin", "yes", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  response.cookies.set("deshiludo_admin_role", "admin", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });

  return response;
}