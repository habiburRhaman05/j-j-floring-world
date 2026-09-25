"use client";

import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHead } from "@/components/ui/panel";
import { Pill } from "@/components/ui/pill";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableWrap, THead, TBody, Tr, Th, Td } from "@/components/ui/table";
import { toApiError } from "@/lib/api/errors";
import { useFbLeadContacts } from "@/lib/csr/hooks";
import { relative } from "@/lib/format";

interface FbLeadContactsTableProps {
  /** Name of the pipeline currently on the board, for the stage column header. */
  pipelineName: string | null;
  /** contactId -> stage name, for the contacts that have a card on that board. */
  stageByContactId: ReadonlyMap<string, string>;
}

/**
 * Every GHL contact carrying the fb-lead tag, read live from GHL each time the
 * dashboard loads. GHL's own workflow tags new Facebook leads and moves them
 * into lead-qualify, so this table is a straight mirror of that tag; the last
 * column says where each contact sits on the board above.
 */
export function FbLeadContactsTable({ pipelineName, stageByContactId }: FbLeadContactsTableProps) {
  const query = useFbLeadContacts();
  const contacts = query.data?.contacts ?? [];

  return (
    <Panel style={{ marginTop: 16 }}>
      <PanelHead>
        <div>
          <h3>{query.data?.tag ?? "fb-lead"} contacts</h3>
          <div className="t-meta">
            Every contact in GoHighLevel tagged {query.data?.tag ?? "fb-lead"}
            {query.data ? `, ${contacts.length} in total` : ""}.
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          loading={query.isFetching && !query.isPending}
          onClick={() => void query.refetch()}
        >
          Refresh
        </Button>
      </PanelHead>
      <PanelBody>
        {query.isPending ? (
          <Skeleton style={{ width: "100%", height: 120 }} />
        ) : query.error ? (
          <div className="login-alert" role="alert">
            {toApiError(query.error).displayMessage}
          </div>
        ) : contacts.length === 0 ? (
          <div className="t-meta">No contacts are tagged {query.data?.tag ?? "fb-lead"} yet.</div>
        ) : (
          <TableWrap>
            <Table>
              <THead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Phone</Th>
                  <Th>Email</Th>
                  <Th>Location</Th>
                  <Th>Tags</Th>
                  <Th>Added</Th>
                  <Th>{pipelineName ? `${pipelineName} stage` : "Pipeline stage"}</Th>
                </Tr>
              </THead>
              <TBody>
                {contacts.map((c) => {
                  const stage = stageByContactId.get(c.id);
                  return (
                    <Tr key={c.id}>
                      <Td>{c.name}</Td>
                      <Td>{c.phone || "-"}</Td>
                      <Td>{c.email || "-"}</Td>
                      <Td>{[c.city, c.postalCode].filter(Boolean).join(" ") || "-"}</Td>
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
                        {stage ? (
                          <Pill className="pill-moss">{stage}</Pill>
                        ) : (
                          <Pill className="pill-outline">Not on this board</Pill>
                        )}
                      </Td>
                    </Tr>
                  );
                })}
              </TBody>
            </Table>
          </TableWrap>
        )}
      </PanelBody>
    </Panel>
  );
}
