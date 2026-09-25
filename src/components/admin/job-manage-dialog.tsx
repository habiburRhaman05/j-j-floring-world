"use client";

import { useState } from "react";
import { useToast } from "@/components/providers/toast-provider";
import { InvoiceSummary } from "@/components/invoice/line-table";
import { Button } from "@/components/ui/button";
import { CheckField } from "@/components/ui/checkbox";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { Modal, type ModalAction } from "@/components/ui/modal";
import { JobRail } from "@/components/pipeline/job-rail";
import { StageSelect } from "@/components/pipeline/stage-select";
import {
  useAssignInstaller,
  useConfirmJob,
  useSetJobStage,
  useSetMaterialsReceived,
  useSetPaymentStatus,
} from "@/lib/data/hooks";
import { invoiceForJob } from "@/lib/data/selectors";
import { JOB_STAGES } from "@/lib/constants";
import { dt, fromInputDate, money2, toInputDate } from "@/lib/format";
import type { Database, Job, JobStage, PaymentStatus } from "@/lib/types";

interface JobManageDialogProps {
  job: Job;
  db: Database;
  onClose: () => void;
}

const PAYMENT_STATES: PaymentStatus[] = ["Unpaid", "Partial", "Paid"];

export function JobManageDialog({ job, db, onClose }: JobManageDialogProps) {
  const setJobStage = useSetJobStage();
  const assignInstaller = useAssignInstaller();
  const setMaterialsReceived = useSetMaterialsReceived();
  const confirmJob = useConfirmJob();
  const setPaymentStatus = useSetPaymentStatus();
  const { toast } = useToast();

  const [open, setOpen] = useState(true);
  const [installerId, setInstallerId] = useState(job.installerId ?? "");
  const [scheduledDate, setScheduledDate] = useState(toInputDate(job.scheduledDate));

  const lead = db.leads.find((l) => l.id === job.leadId) ?? null;
  const invoice = invoiceForJob(db, job.id);
  const installers = db.users.filter((u) => u.role === "Installer");

  const actions: ModalAction[] = [{ label: "Close", variant: "ghost" }];

  if (job.stage === "Completed" && !job.adminConfirmedAt) {
    actions.push({
      label: "Confirm completion",
      variant: "go",
      onClick: async () => {
        try {
          await confirmJob.mutateAsync([job.id]);
        } catch {
          return false;
        }
        toast("Completion confirmed.", "ok");
      },
    });
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) onClose();
      }}
      title={lead ? lead.name : job.id}
      subtitle={
        `Job ${job.id}` +
        (job.adminConfirmedAt ? `, confirmed ${dt(job.adminConfirmedAt)}` : "")
      }
      wide
      actions={actions}
    >
      <JobRail currentStage={job.stage} />
      <hr className="divider" />

      <div className="label">Stage</div>
      <StageSelect
        value={job.stage}
        stages={JOB_STAGES}
        onChange={(stage: JobStage) => {
          setJobStage.mutate([job.id, stage]);
          toast(`Job moved to ${stage}.`, "ok");
        }}
      />

      <hr className="divider" />
      <div className="field-row">
        <Field label="Installer" className="grow">
          <Select value={installerId} onChange={(event) => setInstallerId(event.target.value)}>
            <option value="">Unassigned</option>
            {installers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Scheduled date" className="grow">
          <Input
            type="date"
            value={scheduledDate}
            onChange={(event) => setScheduledDate(event.target.value)}
          />
        </Field>
      </div>
      <Button
        size="sm"
        variant="primary"
        onClick={() => {
          assignInstaller.mutate([job.id, installerId || null, fromInputDate(scheduledDate)]);
          toast("Schedule saved.", "ok");
        }}
      >
        Save schedule
      </Button>

      <hr className="divider" />
      <CheckField
        checked={job.materialsReceived}
        aria-label="Materials received at the warehouse"
        onCheckedChange={(checked) => setMaterialsReceived.mutate([job.id, checked])}
      >
        Materials received at the warehouse
      </CheckField>

      {job.photos && job.photos.length ? (
        <>
          <hr className="divider" />
          <div className="label">Job photos</div>
          <div className="photo-grid">
            {job.photos.map((photo) => (
              <div key={photo.id} className="photo-chip">
                <span className="lbl">{photo.label}</span>
                <span className="tm">{dt(photo.at, true)}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {invoice ? (
        <>
          <hr className="divider" />
          <div className="label">Invoice {invoice.id}</div>
          <InvoiceSummary
            totalPrice={invoice.totalPrice}
            totalCost={invoice.totalCost}
            totalMargin={invoice.totalMargin}
            depositPercent={invoice.depositPercent}
            depositAmount={invoice.depositAmount}
            depositPaid={invoice.depositPaid}
            balanceAmount={invoice.balanceAmount}
            showCost
          />
          <div style={{ marginTop: 12 }}>
            <div className="row-wrap">
              {PAYMENT_STATES.map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={invoice.paymentStatus === status ? "primary" : "default"}
                  onClick={() => {
                    setPaymentStatus.mutate([invoice.id, status]);
                    toast(`Invoice marked ${status}.`, status === "Paid" ? "ok" : "");
                  }}
                >
                  Mark {status}
                </Button>
              ))}
            </div>
          </div>
          <div className="t-meta" style={{ marginTop: 10 }}>
            Balance {money2(invoice.balanceAmount)}
          </div>
        </>
      ) : null}
    </Modal>
  );
}
