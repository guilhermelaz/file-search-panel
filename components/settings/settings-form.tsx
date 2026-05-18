"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";

interface HealthResult {
  ok: boolean;
  storesCount?: number;
  error?: string;
}

export function SettingsForm() {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<HealthResult | null>(null);

  const test = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health");
      setResult(await res.json());
    } catch (err) {
      setResult({ ok: false, error: String(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    test();
  }, [test]);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">
          A chave da API é lida da variável de ambiente{" "}
          <code className="text-xs bg-muted px-1 rounded">GOOGLE_API_KEY</code>.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status da Conexão</CardTitle>
          <CardDescription>Verifica se o app consegue acessar a Google File Search API.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Testando conexão...
            </div>
          ) : result?.ok ? (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Conectado com sucesso</p>
                <p className="text-sm text-muted-foreground">
                  {result.storesCount ?? 0} store(s) encontrados na sua conta Google.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="font-medium">Falha na conexão</p>
                <p className="text-xs text-muted-foreground break-all mt-1 font-mono">
                  {result?.error || "Erro desconhecido"}
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Verifique se a variável <code className="bg-muted px-1 rounded">GOOGLE_API_KEY</code>{" "}
                  está definida no ambiente do container.
                </p>
              </div>
            </div>
          )}

          <Button variant="outline" onClick={test} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Testar Novamente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
