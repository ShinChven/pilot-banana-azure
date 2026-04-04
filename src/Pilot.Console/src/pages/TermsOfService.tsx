import * as React from "react";
import { Link } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription
} from "@/src/components/ui/card";
import { BananaLogo } from "../components/BananaLogo";
import { Button } from "../components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b flex items-center justify-between px-6 sticky top-0 bg-background/80 backdrop-blur-md z-50">
        <Link to="/" className="flex items-center gap-3">
          <BananaLogo className="w-8 h-8" />
          <span className="text-lg font-bold tracking-tight">Pilot Banana</span>
        </Link>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/login" className="flex items-center gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Sign in
          </Link>
        </Button>
      </header>

      <div className="w-full py-10">
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="px-0">
            <CardTitle className="text-4xl font-bold tracking-tight">Terms of Service</CardTitle>
            <CardDescription className="text-lg">
              Last updated: April 3, 2026
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 prose prose-slate dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing or using Pilot Banana, you agree to be bound by these Terms of Service. If you do not agree to all of these terms, do not use our services.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">2. Content Restrictions</h2>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6 mb-4">
                <h3 className="text-xl font-bold text-destructive mb-2">Strict Ban on Adult Content</h3>
                <p className="text-foreground font-medium">
                  The transmission, distribution, or storage of any adult, sexually explicit, or pornographic content is strictly prohibited on Pilot Banana.
                </p>
                <p className="mt-2 text-destructive font-bold">
                  Violation of this policy will result in immediate and permanent deactivation of your account without prior notice.
                </p>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">3. User Conduct</h2>
              <p className="text-muted-foreground leading-relaxed">
                You are responsible for all activity that occurs under your account. You must not use the service for any illegal or unauthorized purpose. You must not, in the use of the service, violate any laws in your jurisdiction.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">4. Account Deactivation</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify or terminate the service for any reason, without notice at any time. We may also deactivate accounts that violate our terms or for any other reason we deem necessary to protect our community and platform.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">5. Ownership and Author</h2>
              <p className="text-muted-foreground leading-relaxed">
                Pilot Banana is authored and maintained by <strong>ShinChven</strong>. All rights reserved.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">6. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                In no event shall ShinChven or Pilot Banana be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
              </p>
            </section>

            <footer className="mt-12 pt-8 border-t border-border text-sm text-muted-foreground">
              &copy; 2026 ShinChven. All rights reserved.
            </footer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
