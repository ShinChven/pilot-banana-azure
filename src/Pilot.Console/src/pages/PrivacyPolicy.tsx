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

export default function PrivacyPolicy() {
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
            <CardTitle className="text-4xl font-bold tracking-tight">Privacy Policy</CardTitle>
            <CardDescription className="text-lg">
              Last updated: April 3, 2026
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 prose prose-slate dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">1. Information Collection</h2>
              <p className="text-muted-foreground leading-relaxed">
                We collect information you provide directly to us when you create an account, use our services, or communicate with us. This may include your email address, profile information, and the content you manage through our platform.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">2. Use of Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                We use the information we collect to provide, maintain, and improve our services, to develop new ones, and to protect Pilot Banana and our users.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">3. Data Sharing</h2>
              <p className="text-muted-foreground leading-relaxed">
                We do not share your personal information with companies, organizations, or individuals outside of Pilot Banana except in the cases of user consent, external processing (by trusted third-party services like X API), or legal reasons.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">4. Data Security</h2>
              <p className="text-muted-foreground leading-relaxed">
                We work hard to protect Pilot Banana and our users from unauthorized access to or unauthorized alteration, disclosure, or destruction of information we hold.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">5. Author and Contact</h2>
              <p className="text-muted-foreground leading-relaxed">
                Pilot Banana is authored by <strong>ShinChven</strong>. If you have any questions about this Privacy Policy, please contact us.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4 text-foreground">6. Strict Content Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                To maintain a safe and professional environment, we monitor for and strictly prohibit adult content. Sending such content will result in account deactivation.
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
