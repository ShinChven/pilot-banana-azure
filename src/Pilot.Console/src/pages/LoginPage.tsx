import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Fingerprint, Mail, Lock, ArrowRight, Github, Chrome, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { cn } from '@/src/lib/utils';
import { motion } from 'motion/react';
import { BananaLogo } from '../components/BananaLogo';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import * as passkeysApi from '../api/passkeys';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, loginWithToken } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const [passkeyLoading, setPasskeyLoading] = React.useState(false);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || '/';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await login(email, password, true);
      if (result.error) {
        setError(result.error);
        toast.error('Login Failed', {
          description: result.error,
        });
      } else {
        toast.success('Welcome back!', {
          description: 'You have successfully signed in.',
        });
        navigate(from, { replace: true });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(msg);
      toast.error('Login Error', {
        description: msg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  function base64ToBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64.replace(/-/g, '+').replace(/_/g, '/'))
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  function bufferToBase64(buffer: ArrayBuffer): string {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '')
  }

  const handlePasskeyLogin = async () => {
    setError(null);
    setPasskeyLoading(true);
    try {
      const { data: options, error: optError } = await passkeysApi.getLoginOptions();
      if (optError || !options) {
        throw new Error(optError || 'Failed to get login options');
      }

      const credentialRequestOptions: CredentialRequestOptions = {
        publicKey: {
          challenge: base64ToBuffer(options.challenge),
          rpId: options.rpId,
          userVerification: options.userVerification,
          timeout: options.timeout
        }
      };

      const assertion = (await navigator.credentials.get(credentialRequestOptions)) as PublicKeyCredential;
      if (!assertion) throw new Error('Passkey interaction cancelled or failed');

      const response = assertion.response as AuthenticatorAssertionResponse;

      const verifyBody = {
        sessionId: options.sessionId,
        credentialId: assertion.id,
        authenticatorData: bufferToBase64(response.authenticatorData),
        clientDataJSON: bufferToBase64(response.clientDataJSON),
        signature: bufferToBase64(response.signature),
        userHandle: response.userHandle ? bufferToBase64(response.userHandle) : ''
      };

      const { data: verifyData, error: verifyError } = await passkeysApi.verifyLoginToken(verifyBody);
      if (verifyError || !verifyData) {
        throw new Error(verifyError || 'Passkey verification failed');
      }

      const tokenStr = verifyData.accessToken || verifyData.AccessToken;
      if (tokenStr) {
        const loginRes = await loginWithToken(tokenStr);
        if (loginRes.error) throw new Error(loginRes.error);
        
        toast.success('Welcome back!', {
          description: 'Signed in with passkey.',
        });
        navigate(from, { replace: true });
      } else {
        throw new Error('No token returned from server.');
      }

    } catch (err: any) {
      console.error(err);
      const msg = err.message || 'Passkey login failed';
      setError(msg);
      toast.error('Passkey Login Failed', {
        description: msg,
      });
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      {/* Abstract Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-3xl animate-pulse delay-700" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md px-8 relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <BananaLogo className="w-16 h-16 mb-4 drop-shadow-xl" />
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Welcome back</h1>
          <p className="text-muted-foreground mt-2">Enter your credentials to access Pilot Banana</p>
        </div>

        <div className="bg-card border rounded-3xl p-8 shadow-xl shadow-foreground/5">
          {error && (
            <div className="mb-6 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@example.com" 
                  className="pl-10 h-12 rounded-xl bg-muted/50 border-muted-foreground/10 focus:bg-background transition-all"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  className="pl-10 h-12 rounded-xl bg-muted/50 border-muted-foreground/10 focus:bg-background transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-12 rounded-xl font-semibold text-base shadow-lg shadow-primary/20 group"
              disabled={isLoading || passkeyLoading}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <Button 
              variant="outline" 
              className="h-12 rounded-xl border-primary/20 hover:bg-primary/5 hover:border-primary/40 transition-all flex items-center justify-center gap-3 group"
              onClick={handlePasskeyLogin}
              disabled={isLoading || passkeyLoading}
            >
              {passkeyLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              ) : (
                <Fingerprint className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" />
              )}
              <span className="font-semibold">
                {passkeyLoading ? 'Verifying...' : 'Sign in with Passkey'}
              </span>
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
