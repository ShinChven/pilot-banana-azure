import { apiGet, apiPost, apiDelete } from './client';

export interface Passkey {
  credentialId: string;
  publicKey: string;
  userHandle: string;
  label: string;
  createdAt: string;
}

export function listPasskeys(token: string) {
  return apiGet<Passkey[]>('/auth/passkeys', token);
}

export function deletePasskey(credentialId: string, token: string) {
  return apiDelete(`/auth/passkeys/${credentialId}`, token);
}

export function getRegisterOptions(token: string) {
  return apiPost<any>('/auth/passkeys/register-options', {}, token);
}

export type RegisterPasskeyBody = {
  id: string;
  rawId: string;
  type: string;
  response: {
    attestationObject: string;
    clientDataJSON: string;
  };
};

export function registerPasskey(body: RegisterPasskeyBody, token: string) {
  return apiPost<void>('/auth/passkeys/register', body, token);
}

export function getLoginOptions() {
  return apiPost<any>('/auth/passkeys/login-options', {}, null);
}

export function verifyLoginToken(body: {
  sessionId: string;
  credentialId: string;
  authenticatorData: string;
  clientDataJSON: string;
  signature: string;
  userHandle: string
}) {
  // We use apiPost without token because it's a login method
  // which will return { accessToken: ... }
  return apiPost<any>('/auth/passkeys/login-verify', body, null);
}
