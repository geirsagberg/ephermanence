import type { Attachment, Thought } from './types';

function connectedIds(id: string, attachments: Attachment[]) {
  const result = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [a, b] of attachments) {
      if (result.has(a) && !result.has(b)) {
        result.add(b);
        changed = true;
      }
      if (result.has(b) && !result.has(a)) {
        result.add(a);
        changed = true;
      }
    }
  }
  return result;
}

export function getMovingThoughtIds(
  id: string,
  attachments: Attachment[],
  singular: boolean,
) {
  return singular ? new Set([id]) : connectedIds(id, attachments);
}

export function translateThoughts(
  thoughts: Thought[],
  movingIds: Set<string>,
  dx: number,
  dy: number,
  width: number,
  height: number,
) {
  return thoughts.map((thought) => {
    if (!movingIds.has(thought.id)) return thought;
    return {
      ...thought,
      x: Math.max(thought.radius, Math.min(width - thought.radius, thought.x + dx)),
      y: Math.max(thought.radius, Math.min(height - thought.radius, thought.y + dy)),
    };
  });
}

function attachmentKey([a, b]: Attachment) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function areTouching(a: Thought, b: Thought) {
  return Math.hypot(b.x - a.x, b.y - a.y) <= a.radius + b.radius;
}

export function recalculateAttachments(
  thoughts: Thought[],
  attachments: Attachment[],
  movedIds: Set<string>,
  singular: boolean,
) {
  const next = singular
    ? attachments.filter(([a, b]) => !movedIds.has(a) && !movedIds.has(b))
    : [...attachments];
  const keys = new Set(next.map(attachmentKey));

  for (let index = 0; index < thoughts.length; index += 1) {
    const a = thoughts[index];
    for (let targetIndex = index + 1; targetIndex < thoughts.length; targetIndex += 1) {
      const b = thoughts[targetIndex];
      if (movedIds.has(a.id) === movedIds.has(b.id) || !areTouching(a, b)) continue;

      const attachment: Attachment = movedIds.has(a.id) ? [a.id, b.id] : [b.id, a.id];
      const key = attachmentKey(attachment);
      if (keys.has(key)) continue;
      keys.add(key);
      next.push(attachment);
    }
  }

  return next;
}
