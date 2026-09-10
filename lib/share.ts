/** Share-card copy for X / clipboard. Keep out of "use client" modules so server pages can call it. */
export function shareText(rarity: string, botName: string): string {
  const flex = rarity === "legendary" ? " It's LEGENDARY. 1-in-20." : rarity === "rare" ? " Pulled a RARE." : "";
  return `Just printed my Grok Bot badge at #GrokBotAustin 🤖 Meet ${botName}.${flex}`;
}
