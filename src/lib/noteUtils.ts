/**
 * Parsea el contenido de una nota que puede ser texto plano o JSON con historial.
 */
export const parseNoteContent = (raw: string): { current: string; history: string[] } => {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed?.current)
      return { current: parsed.current, history: Array.isArray(parsed.history) ? parsed.history : [] };
  } catch {}
  return { current: raw, history: [] };
};
