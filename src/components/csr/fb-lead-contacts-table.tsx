"use client";

import { useQuery } from "@tanstack/react-query";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { Table, TableWrap, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { relative } from "@/lib/format";
import { apiGet } from "@/lib/api/client";
import { endpoints } from "@/lib/api/endpoints";

interface FbLeadContact {
  id: string;
  name: string;
  phone: string;
  email: string;
  tags: string[];
  dateAdded: string | null;
  inPipeline: boolean;
}

interface LeadsResponse {
  contacts: FbLeadContact[];
}

/**
 * Every GHL contact carrying the configured lead tag (fb-lead by default),
 * whether or not it has made it into the pipeline yet. This is the raw feed
 * from Facebook Lead Ads - the board above shows only the ones with an open
 * opportunity; this table is the full list underneath it.
 */
export function FbLeadContactsTable() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["csr", "fb-lead-contacts"],
    queryFn: () => apiGet<LeadsResponse>(endpoints.leads.list),
    staleTime: 15_000,
  });

  return (
    <Panel style={{ marginTop: 16 }}>
      <PanelHead>
        <div>
          <h3>fb-lead contacts</h3>
          <div className="t-meta">Every GHL contact tagged fb-lead, board status included.</div>
        </div>
      </PanelHead>
      <PanelBody>
        {isLoading ? (
          <Skeleton style={{ width: "100%", height: 120 }} />
        ) : error ? (
          <div className="login-alert" role="alert">
            {error instanceof Error ? error.message : "Couldn't load contacts."}
          </div>
        ) : !data || data.contacts.length === 0 ? (
          <div className="t-meta">No contacts tagged fb-lead yet.</div>
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Phone</Th>
                  <Th>Email</Th>
                  <Th>Tags</Th>
                  <Th>Added</Th>
                  <Th>Board status</Th>
                </Tr>
              </THead>
              <TBody>
                {data.contacts.map((c) => (
                  <Tr key={c.id}>
                    <Td>{c.name}</Td>
                    <Td>{c.phone || "-"}</Td>
                    <Td>{c.email || "-"}</Td>
                    <Td>
                      {c.tags.length
                        ? c.tags.map((t) => (
                            <Pill key={t} className="pill-outline" title={t}>
                              {t}
                            </Pill>
                          ))
                        : "-"}
                    </Td>
                    <Td>{c.dateAdded ? relative(c.dateAdded) : "-"}</Td>
                    <Td>
                      {c.inPipeline ? (
                        <Pill className="pill-moss">On board</Pill>
                      ) : (
                        <Pill className="pill-outline">Not in pipeline</Pill>
                      )}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </PanelBody>
    </Panel>
  );
}
