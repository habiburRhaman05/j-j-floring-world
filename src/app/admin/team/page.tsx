"use client";

import { AdminTeam } from "@/components/admin/team-view";
import { ViewSection } from "@/components/layout/view-section";

export default function AdminTeamPage() {
  return (
    <ViewSection
      viewKey="team"
      heading="Team"
      sub="Every account and its sign-in email. The role decides what that login can open."
    >
      <AdminTeam />
    </ViewSection>
  );
}
