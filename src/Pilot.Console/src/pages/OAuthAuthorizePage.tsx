import * as React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter
} from "@/src/components/ui/card";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import { Loader2, Shield, ExternalLink } from 'lucide-react';
import { toast } from "sonner";
import { useAuth } from '../context/AuthContext';
import { approveOAuth } from '../api/apiClients';

export default function OAuthAuthorizePage() {
  const { token, user, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [isApproving, setIsApproving] = React.useState(false);

  const clientId = searchParams.get('client_id') ?? '';
  const redirectUri = searchParams.get('redirect_uri') ?? '';
  const state = searchParams.get('state') ?? '';
  const scope = searchParams.get('scope') ?? '';
  const codeChallenge = searchParams.get('code_challenge') ?? '';
  const codeChallengeMethod = searchParams.get('code_challenge_method') ?? '';

  // If not logged in, redirect to login with return URL
  React.useEffect(() => {
    if (!loading && !token) {
      const returnUrl = `/oauth/authorize?${searchParams.toString()}`;
      navigate(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
    }
  }, [loading, token, navigate, searchParams]);

  const handleApprove = async () => {
    if (!token) return;
    setIsApproving(true);
    try {
      const { data, error } = await approveOAuth(
        {
          clientId,
          redirectUri: redirectUri || undefined,
          state: state || undefined,
          codeChallenge: codeChallenge || undefined,
          codeChallengeMethod: codeChallengeMethod || undefined,
        },
        token
      );
      if (error) {
        toast.error("Authorization failed", { description: error });
      } else if (data?.redirectUrl) {
        // Redirect to the callback URL (e.g., back to Claude)
        window.location.href = data.redirectUrl;
        return;
      }
    } catch {
      toast.error("Error during authorization");
    } finally {
      setIsApproving(false);
    }
  };

  const handleDeny = () => {
    if (redirectUri) {
      const url = new URL(redirectUri);
      url.searchParams.set('error', 'access_denied');
      if (state) url.searchParams.set('state', state);
      window.location.href = url.toString();
    } else {
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!clientId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid Request</CardTitle>
            <CardDescription>Missing required parameter: client_id</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/30">
      <Card className="w-full max-w-md shadow-xl border-muted-foreground/10">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div>
            <CardTitle className="text-xl">Authorize Application</CardTitle>
            <CardDescription className="mt-2">
              An application is requesting access to your Pilot Banana account.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* User info */}
          {user && (
            <div className="p-3 bg-muted/30 border rounded-xl">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="text-sm font-bold text-foreground">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          )}

          {/* Permissions requested */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">This application will be able to:</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg">
                <Badge variant="secondary" className="text-xs">read</Badge>
                <span className="text-sm text-foreground">View your campaigns and posts</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg">
                <Badge variant="secondary" className="text-xs">read</Badge>
                <span className="text-sm text-foreground">View your posting statistics</span>
              </div>
              {scope && (
                <div className="flex items-center gap-2 p-2 bg-muted/20 rounded-lg">
                  <Badge variant="outline" className="text-xs">scope</Badge>
                  <span className="text-xs font-mono text-muted-foreground">{scope}</span>
                </div>
              )}
            </div>
          </div>

          {/* Redirect info */}
          {redirectUri && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <ExternalLink className="w-3 h-3 shrink-0" />
              <span className="truncate">Will redirect to: {redirectUri}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="flex gap-3 pt-2">
          <Button
            variant="outline"
            className="flex-1 h-11 rounded-xl"
            onClick={handleDeny}
            disabled={isApproving}
          >
            Deny
          </Button>
          <Button
            className="flex-1 h-11 rounded-xl shadow-lg shadow-primary/20"
            onClick={handleApprove}
            disabled={isApproving}
          >
            {isApproving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            Authorize
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
