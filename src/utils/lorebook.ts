export type LoreEntry = {
  id: string;
  key: string;
  value: string;
  pinned?: boolean;
};

export function injectLoreIntoPrompt(basePrompt: string, lore: LoreEntry[]) {
  if (!lore || lore.length === 0) return basePrompt;
  const sections = lore.map(e => `- ${e.key}: ${e.value}`);
  return `${basePrompt}
\n[LOREBOOK - Injected Knowledge]\n${sections.join('\n')}
\n[END LOREBOOK]\n`;
}
