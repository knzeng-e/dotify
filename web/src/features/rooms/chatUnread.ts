type MessageIdentity = { id: string; senderId: string };
export type ChatReadState = { seen: string[]; unread: number };

export function updateChatUnread(state: ChatReadState | null, messages: MessageIdentity[], selfId: string | undefined, readingLatest: boolean): ChatReadState {
  const seen = new Set(state?.seen ?? messages.map(message => message.id));
  const newMessages = messages.filter(message => !seen.has(message.id) && message.senderId !== selfId);
  for (const message of messages) seen.add(message.id);
  return { seen: [...seen].slice(-500), unread: readingLatest ? 0 : (state?.unread ?? 0) + newMessages.length };
}
