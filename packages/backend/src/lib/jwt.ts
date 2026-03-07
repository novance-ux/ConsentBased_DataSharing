import * as jose from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-change-me')

export async function signJwt(payload: Record<string, unknown>): Promise<string> {
  return new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRY || '24h')
    .sign(secret)
}

export async function verifyJwt(token: string) {
  const { payload } = await jose.jwtVerify(token, secret)
  return payload
}
