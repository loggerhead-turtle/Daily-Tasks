export type Member = {
  id: string;
  family_id: string;
  name: string;
  role: "parent" | "child";
  color: string;
  emoji: string;
  avatar_url: string | null;
  sort_order: number;
};

export type Family = {
  id: string;
  name: string;
  invite_code: string;
  parent_pin_hash: string | null;
  weather_lat: number | null;
  weather_lon: number | null;
  weather_location: string | null;
  screensaver_minutes: number;
};

export type Chore = {
  id: string;
  family_id: string;
  title: string;
  description: string | null;
  emoji: string;
  points: number;
  cents: number; // real-money value paid out for finishing this chore
  assign_type: "fixed" | "rotation" | "grab";
  member_id: string | null;
  rotation_member_ids: string[];
  recurrence: "daily" | "weekly" | "once";
  days_of_week: number[];
  once_date: string | null;
  active: boolean;
};

export type ChoreInstance = {
  id: string;
  family_id: string;
  chore_id: string;
  date: string;
  member_id: string | null;
  status: "todo" | "pending" | "approved" | "rejected";
  completed_at: string | null;
  reviewed_at: string | null;
  points_awarded: number | null;
  chore?: Chore;
};

export type Reward = {
  id: string;
  family_id: string;
  title: string;
  emoji: string;
  cost: number;
  active: boolean;
};

export type Redemption = {
  id: string;
  family_id: string;
  reward_id: string;
  member_id: string;
  cost: number;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reward?: Reward;
};

export type Earning = {
  id: string;
  family_id: string;
  member_id: string;
  cents: number; // + earned, − paid out
  reason: string;
  kind: "chore" | "payout" | "adjustment";
  chore_instance_id: string | null;
  created_at: string;
};

export type Meal = {
  id: string;
  family_id: string;
  date: string;
  title: string;
  emoji: string;
};

export type Announcement = {
  id: string;
  family_id: string;
  message: string;
  emoji: string;
  starts_on: string;
  ends_on: string | null;
};

export type CalendarLink = {
  id: string;
  family_id: string;
  connection_id: string;
  google_calendar_id: string;
  label: string;
  member_id: string | null;
  color: string | null;
  enabled: boolean;
};

export type GoogleConnection = {
  id: string;
  family_id: string;
  profile_id: string;
  google_email: string;
  refresh_token: string;
  access_token: string | null;
  access_token_expires: string | null;
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string; // ISO datetime or yyyy-MM-dd for all-day
  end: string;
  allDay: boolean;
  color: string;
  memberId: string | null;
  calendarLabel: string;
};

export type Weather = {
  temp: number;
  hi: number;
  lo: number;
  code: number;
  location: string;
};

import type { BoardLayout } from "./boardLayout";

// The full payload the kitchen board polls for.
export type BoardState = {
  family: {
    id: string;
    name: string;
    screensaver_minutes: number;
    has_pin: boolean;
    board_layout: BoardLayout | null;
  };
  members: (Member & { balance: number })[];
  chores: ChoreInstance[];
  rewards: Reward[];
  redemptions: Redemption[];
  meals: Meal[];
  announcements: Announcement[];
  weather: Weather | null;
  photos: string[];
  pendingCount: number;
};
