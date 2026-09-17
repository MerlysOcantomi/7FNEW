import { NextRequest, NextResponse } from "next/server"
import { getGoogleAuthUrl, getCallbackUrl } from "@core/auth/google"
import {
  ENTRY_PRODUCT_COOKIE,
  getEntryProductByKey,
  resolveEntryProductFromHost,
} from "@core/product-entry"

export async function GET(request: NextRequest) {
  if (process.env.DISABLE_GOOGLE_AUTH === "true") {
    return NextResponse.redirect(new URL("/login?error=google_disabled", request.url))
  }

  try {
    const explicitProduct = getEntryProductByKey(request.nextUrl.searchParams.get("product"))
    const hostProduct = resolveEntryProductFromHost(request.headers.get("host") ?? request.nextUrl.host)
    const product = explicitProduct ?? hostProduct

    const state = crypto.randomUUID()
    const redirectUri = getCallbackUrl(request.url)
    const authUrl = getGoogleAuthUrl(redirectUri, state)

    const response = NextResponse.redirect(authUrl)
    response.cookies.set("oauth-state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 10,
    })

    if (product) {
      response.cookies.set(ENTRY_PRODUCT_COOKIE, product.key, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 10,
      })
    } else {
      response.cookies.delete(ENTRY_PRODUCT_COOKIE)
    }

    return response
  } catch (error) {
    console.error("[7F Auth] Login error:", error)
    return NextResponse.redirect(new URL("/login?error=config", request.url))
  }
}
