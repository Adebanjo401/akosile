import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <CardTitle className="font-[family-name:var(--font-display)] text-3xl text-primary">
            Akosile
          </CardTitle>
          <CardDescription>
            You&apos;re offline. Open a page you&apos;ve already visited, or
            reconnect to load more.
          </CardDescription>
        </CardHeader>
        <CardFooter className="justify-center">
          <Button asChild className="hover:bg-[var(--akosile-primary-dark)]">
            <Link href="/today">Try Today</Link>
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
