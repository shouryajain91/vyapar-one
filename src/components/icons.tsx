export const ICONS = {
  chart: "M4 20V10 M10 20V4 M16 20v-7 M22 20H2",
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12Z",
  template: "M7 3h7l5 5v13H7V3Z M14 3v5h5 M10 13h6 M10 17h6",
  shield: "M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6l-8-3Z",
  logout: "M15 17l5-5-5-5 M20 12H9 M12 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h7",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  x: "M6 6l12 12 M18 6 6 18",
  plus: "M12 5v14 M5 12h14",
  refresh: "M20 11a8 8 0 0 0-14.9-3 M4 5v4h4 M4 13a8 8 0 0 0 14.9 3 M20 19v-4h-4",
  send: "M22 2 11 13 M22 2l-7 20-4-9-9-4 20-7Z",
  trash: "M4 7h16 M10 11v6 M14 11v6 M6 7l1 13h10l1-13 M9 7V4h6v3",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  phone: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z",
  check: "M5 13l4 4L19 7",
  back: "M15 6l-6 6 6 6",
  image: "M4 5h16v14H4V5Z M4 16l5-5 4 4 3-3 4 4 M9 9.5h.01",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z M4 21a8 8 0 0 1 16 0",
} as const;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className = "h-4 w-4" }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}
