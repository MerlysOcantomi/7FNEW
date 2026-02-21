const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo"

interface GoogleConfig {
  clientId: string
  clientSecret: string
}

interface GoogleUser {
  email: string
  name: string
  picture: string
}

function getGoogleConfig(): GoogleConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET deben estar configurados")
  }
  return { clientId, clientSecret }
}

export function getGoogleAuthUrl(redirectUri: string, state: string): string {
  const { clientId } = getGoogleConfig()
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    state,
  })
  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForTokens(code: string, redirectUri: string) {
  const { clientId, clientSecret } = getGoogleConfig()

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  })

  if (!res.ok) {
    const error = await res.text()
    console.error("[7F Auth] Google token exchange error:", error)
    throw new Error("Error al intercambiar codigo con Google")
  }

  return res.json()
}

export async function getGoogleUser(accessToken: string): Promise<GoogleUser> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!res.ok) {
    throw new Error("Error al obtener informacion del usuario de Google")
  }

  const data = await res.json()
  return {
    email: data.email,
    name: data.name,
    picture: data.picture,
  }
}

export function getCallbackUrl(requestUrl: string): string {
  const url = new URL(requestUrl)
  return `${url.origin}/api/auth/callback/google`
}
