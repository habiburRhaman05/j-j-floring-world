import { relative } from "@/lib/format";
import type { LeadNote, User } from "@/lib/types";

/** The outreach log, newest first, with who wrote it and when. */
export function LeadNotes({ notes, users }: { notes: LeadNote[]; users: User[] }) {
  if (!notes.length) return null;
  return (
    <div style={{ marginTop: 12 }}>
      {notes.map((note) => {
        const author = users.find((u) => u.id === note.by);
        return (
          <div key={`${note.at}-${note.text}`} className="note-row">
            <div className="nr-text">{note.text}</div>
            <div className="nr-meta">
              {(author ? author.name : "System") + ", " + relative(note.at)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
