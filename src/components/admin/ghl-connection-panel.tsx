"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { apiGet, apiPatch, apiPost } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";
import { toApiError, type ApiError } from "@/lib/api/errors";

interface GhlStatus {
  connected: boolean;
  locationId?: string;
  maskedToken?: string;
  connectedAt?: string | null;
  lastVerifiedAt?: string | null;
  lastVerifyError?: string | null;
}

const GHL_QUERY_KEY = ["admin", "ghl-connection"] as const;

/**
 * Real GHL connection settings. Doc 05 flags the exact API surface as
 * unverified pending the integration spike, so "Test connection" is a
 * best-effort check, not a guarantee - it is here so an admin can find out
 * whether the credentials work without asking a developer.
 */
export function GhlConnectionPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: GHL_QUERY_KEY,
    queryFn: () => apiGet<GhlStatus>(endpoints.settings.ghl.get),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: GHL_QUERY_KEY });

  const [locationId, setLocationId] = useState("");
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveError, setSaveError] = useState<ApiError | null>(null);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await apiPatch(endpoints.settings.ghl.save, { locationId, token });
      toast("GoHighLevel connection saved.", "ok");
      setToken("");
      invalidate();
    } catch (thrown) {
      setSaveError(toApiError(thrown));
    } finally {
      setSaving(false);
    }
  }

  async function onTest() {
    setTesting(true);
    try {
      await apiPost(endpoints.settings.ghl.test);
      toast("Connection verified.", "ok");
    } catch (thrown) {
      toast(toApiError(thrown).displayMessage, "warn");
    } finally {
      invalidate();
      setTesting(false);
    }
  }

  if (isLoading) {
    return (
      <Panel style={{ marginBottom: 16 }}>
        <PanelHead>
          <div>
            <h3>GoHighLevel connection</h3>
          </div>
        </PanelHead>
        <PanelBody>
          <Skeleton style={{ width: "60%", marginBottom: 10 }} />
          <Skeleton style={{ width: "100%", height: 38, marginBottom: 10 }} />
          <Skeleton style={{ width: "100%", height: 38 }} />
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel style={{ marginBottom: 16 }}>
      <PanelHead>
        <div>
          <h3>GoHighLevel connection</h3>
          <div className="t-meta">
            {status?.connected ? (
              <>
                Connected to location <code>{status.locationId}</code>
                {" · token "}
                <code>{status.maskedToken}</code>
              </>
            ) : (
              "Not connected yet."
            )}
          </div>
        </div>
        {status?.connected ? (
          <Pill className="pill-outline">
            {status.lastVerifyError
              ? "Verification failed"
              : status.lastVerifiedAt
                ? `Verified ${new Date(status.lastVerifiedAt).toLocaleString()}`
                : "Not yet verified"}
          </Pill>
        ) : null}
      </PanelHead>
      <PanelBody>
        {status?.lastVerifyError ? (
          <div className="login-alert" role="alert" style={{ marginBottom: 12 }}>
            {status.lastVerifyError}
          </div>
        ) : null}
        {saveError ? (
          <div className="login-alert" role="alert" style={{ marginBottom: 12 }}>
            {saveError.displayMessage}
          </div>
        ) : null}

        <form onSubmit={onSave} noValidate>
          <Field label="Location ID">
            <Input
              value={locationId}
              onChange={(e) => setLocationId(e.target.value)}
              placeholder={status?.locationId ?? "GHL location ID"}
              required
            />
          </Field>
          <Field label="Private integration token">
            <Input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={status?.connected ? "Enter a new token to replace it" : "GHL private integration token"}
              required
            />
          </Field>
          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <Button type="submit" variant="primary" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save connection"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={!status?.connected || testing}
              onClick={onTest}
            >
              {testing ? "Testing…" : "Test connection"}
            </Button>
          </div>
        </form>
      </PanelBody>
    </Panel>
  );
}
