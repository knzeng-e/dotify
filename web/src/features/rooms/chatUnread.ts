type MessageIdentity = { id: string; senderId: string; mentions?: string[]; replyTo?: { senderId: string } };
export type ChatReadState = { seen: string[]; unread: number; mentions: number; firstUnread?: string };

export function updateChatUnread(state: ChatReadState | null, messages: MessageIdentity[], selfId: string | undefined, readingLatest: boolean): ChatReadState {
  const seen = new Set(state?.seen ?? messages.map(message => message.id));
  const newMessages = messages.filter(message => !seen.has(message.id) && message.senderId !== selfId && message.senderId !== 'dotify-confirmed-tip');
  for (const message of messages) seen.add(message.id);
  const mentioned = newMessages.filter(message => selfId && (message.mentions?.includes(selfId) || message.replyTo?.senderId === selfId));
  return {
    seen: [...seen].slice(-500),
    unread: readingLatest ? 0 : (state?.unread ?? 0) + newMessages.length,
    mentions: readingLatest ? 0 : (state?.mentions ?? 0) + mentioned.length,
    firstUnread: readingLatest ? undefined : (state?.firstUnread ?? newMessages[0]?.id)
  };
}
