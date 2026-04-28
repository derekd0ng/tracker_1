export interface ICSEvent {
  uid: string;
  title: string;
  date: string;
  startTime?: string;
  endTime?: string;
  description?: string;
}

function unfold(raw: string): string {
  return raw.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
}

function getField(block: string, key: string): string | null {
  const m = block.match(new RegExp(`^${key}(?:;[^:]*)?:(.*)`, 'm'));
  return m ? m[1].trim() : null;
}

function parseDate(raw: string | null): { date: string; time?: string } | null {
  if (!raw) return null;
  const clean = raw.replace(/Z$/, '').split('T');
  const datePart = clean[0];
  const timePart = clean[1];
  if (datePart.length !== 8) return null;
  const date = `${datePart.slice(0,4)}-${datePart.slice(4,6)}-${datePart.slice(6,8)}`;
  const time = timePart ? `${timePart.slice(0,2)}:${timePart.slice(2,4)}` : undefined;
  return { date, time };
}

function unescape(s: string): string {
  return s.replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

export function parseICS(text: string): ICSEvent[] {
  const unfolded = unfold(text);
  const events: ICSEvent[] = [];
  const blocks = unfolded.split(/BEGIN:VEVENT/i);

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i];
    const summary = getField(block, 'SUMMARY');
    const uid = getField(block, 'UID');
    if (!summary || !uid) continue;

    const start = parseDate(getField(block, 'DTSTART'));
    if (!start) continue;
    const end = parseDate(getField(block, 'DTEND'));

    const desc = getField(block, 'DESCRIPTION');
    const loc  = getField(block, 'LOCATION');
    const description = [desc, loc].filter((x): x is string => x !== null).map(unescape).join(' · ') || undefined;

    events.push({
      uid,
      title:       unescape(summary),
      date:        start.date,
      startTime:   start.time,
      endTime:     end?.time,
      description,
    });
  }
  return events;
}
