import { NextResponse } from "next/server";

const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export async function POST(req: Request) {
  try {
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
      console.error("Admin credentials are missing in environment variables");

      return NextResponse.json(
        {
          success: false,
          message: "Admin login configuration missing",
        },
        { status: 500 }
      );
    }

    const body = await req.json();

    const username =
      typeof body?.username === "string" ? body.username.trim() : "";

    const password =
      typeof body?.password === "string" ? body.password : "";

    if (
      username !== ADMIN_USERNAME ||
      password !== ADMIN_PASSWORD
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid username or password",
        },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
      message: "Login successful",
    });

    response.cookies.set("deshiludo_admin", "yes", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    return response;
  } catch (error) {
    console.error("Admin login error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Something went wrong",
      },
      { status: 500 }
    );
  }
}