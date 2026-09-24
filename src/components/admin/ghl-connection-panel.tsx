"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
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
  leadPipelineId?: string | null;
  leadTag?: string;
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

  const [leadPipelineId, setLeadPipelineId] = useState("");
  const [leadTag, setLeadTag] = useState("fb-lead");
  const [savingLeadConfig, setSavingLeadConfig] = useState(false);
  const [leadConfigError, setLeadConfigError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (status?.leadPipelineId) setLeadPipelineId(status.leadPipelineId);
    if (status?.leadTag) setLeadTag(status.leadTag);
  }, [status?.leadPipelineId, status?.leadTag]);

  interface GhlPipelineOption {
    id: string;
    name: string;
    stages: { id: string; name: string }[];
  }
  const { data: pipelinesData, isLoading: pipelinesLoading, error: pipelinesError } = useQuery({
    queryKey: ["admin", "ghl-pipelines"],
    queryFn: () => apiGet<{ pipelines: GhlPipelineOption[] }>(endpoints.settings.ghl.pipelines),
    enabled: Boolean(status?.connected),
    retry: false,
  });

  interface TagCheckResult {
    tag: string;
    count: number;
    sample: { id: string; name: string; tags: string[] }[];
  }
  const {
    data: tagCheck,
    isFetching: tagChecking,
    refetch: refetchTagCheck,
  } = useQuery({
    queryKey: ["admin", "ghl-tag-check", leadTag],
    queryFn: () => apiGet<TagCheckResult>(endpoints.settings.ghl.tagCheck(leadTag || "fb-lead")),
    enabled: false,
  });

  async function onSaveLeadConfig(event: FormEvent) {
    event.preventDefault();
    setSavingLeadConfig(true);
    setLeadConfigError(null);
    try {
      await apiPatch(endpoints.settings.ghl.leadConfig, { leadPipelineId, leadTag });
      toast("Lead pipeline settings saved.", "ok");
      invalidate();
    } catch (thrown) {
      setLeadConfigError(toApiError(thrown));
    } finally {
      setSavingLeadConfig(false);
    }
  }

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

      <PanelHead>
        <div>
          <h3>CSR intake pipeline</h3>
          <div className="t-meta">Which GHL pipeline and contact tag the Intake Board reads.</div>
        </div>
      </PanelHead>
      <PanelBody>
        {leadConfigError ? (
          <div className="login-alert" role="alert" style={{ marginBottom: 12 }}>
            {leadConfigError.displayMessage}
          </div>
        ) : null}
        <form onSubmit={onSaveLeadConfig} noValidate>
          <Field label="Pipeline">
            {pipelinesLoading ? (
              <Skeleton style={{ width: "100%", height: 38 }} />
            ) : pipelinesError ? (
              <div className="t-meta">
                {pipelinesError instanceof Error ? pipelinesError.message : "Couldn't load pipelines from GHL."}
              </div>
            ) : (
              <Select value={leadPipelineId} onChange={(e) => setLeadPipelineId(e.target.value)} required>
                <option value="">Select a pipeline…</option>
                {(pipelinesData?.pipelines ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.stages.length} stages)
                  </option>
                ))}
              </Select>
            )}
            <div className="t-meta" style={{ marginTop: 4 }}>
              Fetched live from your connected GHL location - no typing IDs by hand.
            </div>
          </Field>

          <Field label="Lead tag">
            <div className="field-row" style={{ marginBottom: 0 }}>
              <div className="field grow" style={{ marginBottom: 0 }}>
                <Input
                  value={leadTag}
                  onChange={(e) => setLeadTag(e.target.value)}
                  placeholder="fb-lead"
                  required
                />
              </div>
              <Button
                type="button"
                size="sm"
                disabled={tagChecking}
                onClick={() => void refetchTagCheck()}
              >
                {tagChecking ? "Checking…" : "Check tag exists"}
              </Button>
            </div>
            {tagCheck ? (
              <div
                className="t-meta"
                style={{ marginTop: 6, color: tagCheck.count > 0 ? "var(--moss)" : "var(--clay)" }}
              >
                {tagCheck.count > 0
                  ? `Found ${tagCheck.count} contact${tagCheck.count === 1 ? "" : "s"} tagged "${tagCheck.tag}"${
                      tagCheck.sample.length ? `: ${tagCheck.sample.map((s) => s.name).join(", ")}${tagCheck.count > tagCheck.sample.length ? "…" : ""}` : ""
                    }`
                  : `No contacts in GHL currently carry the tag "${tagCheck.tag}". Facebook Lead Ads leads won't show up until they're tagged this exact way (check your GHL automation/workflow that applies the tag).`}
              </div>
            ) : null}
          </Field>

          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <Button type="submit" variant="primary" size="sm" disabled={savingLeadConfig || !leadPipelineId}>
              {savingLeadConfig ? "Saving…" : "Save pipeline settings"}
            </Button>
          </div>
        </form>
      </PanelBody>
    </Panel>
  );
}
