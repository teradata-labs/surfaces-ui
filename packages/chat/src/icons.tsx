/** Small outline icons for the chat's controls, drawn in the text colour at the text's size. */
const PATHS = {
  plus: "M12 5v14 M5 12h14",
  send: "M12 19V5 M6 11l6-6 6 6",
  stop: "M7 7h10v10H7z",
  mic: "M12 4a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V7a3 3 0 0 0-3-3z M6 11a6 6 0 0 0 12 0 M12 17v3",
  talk: "M4 12h2 M8 8v8 M12 5v14 M16 8v8 M20 12h-2",
  chevron: "M7 10l5 5 5-5",
  next: "M10 7l5 5-5 5",
  back: "M14 7l-5 5 5 5",
  data: "M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3z M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6 M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3",
  file: "M6 3h8l4 4v14H6z M14 3v4h4",
  skill: "M5 5h9a3 3 0 0 1 3 3v12H8a3 3 0 0 1-3-3z M5 17a3 3 0 0 1 3-3h9",
  plug: "M9 3v5 M15 3v5 M7 8h10v3a5 5 0 0 1-10 0z M12 16v5",
  agent: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4",
  model: "M12 3l8 4.5v9L12 21l-8-4.5v-9z M12 12l8-4.5 M12 12v9 M12 12L4 7.5",
  sessions: "M4 6h16 M4 12h16 M4 18h10",
  chat: "M4 5h16v11H10l-5 4v-4H4z",
  close: "M6 6l12 12 M18 6L6 18",
  check: "M5 12l5 5 9-10",
  pin: "M9 4h6l-1 6 3 3H7l3-3z M12 13v7",
  search: "M11 5a6 6 0 1 0 0 12 6 6 0 0 0 0-12z M20 20l-4.5-4.5",
  // Three dots across, for an overflow menu: the drawing ItemControls' "more" uses.
  more: "M4.8 12a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0 M10.8 12a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0 M16.8 12a1.2 1.2 0 1 0 2.4 0a1.2 1.2 0 1 0-2.4 0",
  bell: "M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16z M10 21a2 2 0 0 0 4 0",
  about: "M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
} as const;

export type ChatIconName = keyof typeof PATHS;
/** Every name ChatIcon draws. */
export const CHAT_ICONS = Object.keys(PATHS) as ChatIconName[];

export function ChatIcon({ name }: { name: ChatIconName }) {
  return (
    <svg className="sf-chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d={PATHS[name]} />
    </svg>
  );
}
