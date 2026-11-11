"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/features/auth/services/actions";
import { cn } from "@/lib/utils";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="default"
      className="w-full"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Iniciando sesión...
        </>
      ) : (
        "Iniciar sesión"
      )}
    </Button>
  );
}

export function LoginForm({ message }: { message?: string }) {
  const [state, formAction] = useActionState(login, null);

  return (
    <div className={cn("glass rounded-xl p-8 w-full max-w-md space-y-6")}>
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          Hola de nuevo
        </h1>
        <p className="text-sm text-muted-foreground">
          Entra para ver tu agenda y tus mensajes
        </p>
      </div>

      {message && (
        <p
          className="text-sm text-primary bg-primary/10 rounded-md px-3 py-2"
          role="status"
        >
          {message}
        </p>
      )}

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="tu@email.com"
            autoComplete="email"
            aria-required="true"
            required
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="password">Contraseña</Label>
            <Link
              href="/forgot-password"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              ¿La has olvidado?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            aria-required="true"
            required
          />
        </div>

        {state?.error && (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        )}

        <SubmitButton />
      </form>

      <p className="text-center text-sm text-muted-foreground">
        ¿Aún no usas Citaya?{" "}
        <a
          href={process.env.NEXT_PUBLIC_PUBLIC_SITE_URL ?? "https://holacitaya.app"}
          className="text-primary underline-offset-4 hover:underline transition-colors duration-150"
        >
          Pruébalo gratis
        </a>
      </p>
    </div>
  );
}
