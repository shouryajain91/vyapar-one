export const CAMPAIGN_TONE: Record<string, "green" | "amber" | "red" | "slate" | "brand"> = {
  scheduled: "amber",
  running: "brand",
  completed: "green",
  cancelled: "slate",
};
export const CAMPAIGN_LABEL: Record<string, string> = {
  scheduled: "Scheduled",
  running: "Sending",
  completed: "Completed",
  cancelled: "Cancelled",
};
