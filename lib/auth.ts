import { SignJWT, jwtVerify } from 'jose';

const jwtConfig = {
  secret: new TextEncoder().encode(process.env.ADMIN_SECRET_KEY || 'default_secret_for_local_testing_only_galantes'),
};

export async function signToken(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(jwtConfig.secret);
}

export async function verifyToken(token: string) {
  try {
    const { payload } = await jwtVerify(token, jwtConfig.secret);
    return payload;
  } catch (error) {
    return null;
  }
}
