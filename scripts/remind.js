import { WebClient } from '@slack/web-api';
import { parseISO, subWeeks, subDays, subHours, isWithinInterval, format } from 'date-fns';
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz';

// Env vars
const slackToken = process.env.SLACK_BOT_TOKEN;
const channelId = process.env.SLACK_CHANNEL_ID; // e.g., C0123456789
const timezone = process.env.TZ || 'Asia/Tokyo';

if (!slackToken || !channelId) {
  console.error('Missing SLACK_BOT_TOKEN or SLACK_CHANNEL_ID');
  process.exit(1);
}

const client = new WebClient(slackToken);

// Config: how to detect event proposals and their scheduled time
// Assumption: messages contain a line like: "開催日時: 2025-09-30 18:00" (YYYY-MM-DD HH:mm in local TZ)
// Or ISO: 2025-09-30T18:00
// Multiple date/time patterns (Japanese friendly)
// Supported examples:
// - 開催日時: 2025-09-30 18:00
// - 日時: 2025/09/30 18:00
// - 2025年9月30日 18時00分
// - 9月30日 18時（年省略は今年を推定、過去なら翌年）
// - 2025-09-30T18:00
// - 午後7時30分 / 午前9:05 など（年・日付がなければ当日扱いはせず、無効）

const isoLikeWithLabel = [
  /開催日時\s*[:：]\s*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2}[ T]\d{1,2}:\d{2})/,
  /日時\s*[:：]\s*(\d{4}[-\/]\d{1,2}[-\/]\d{1,2}[ T]\d{1,2}:\d{2})/
];

const isoLike = /(\d{4}[-\/]\d{1,2}[-\/]\d{1,2}[ T]\d{1,2}:\d{2})/;

const jpFullYmdHm = /(?:(\d{4})\s*年)?\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*(?:\([^)]*\)\s*)?(?:(午前|午後)\s*)?(\d{1,2})(?:[:：時](\d{1,2}))?\s*(?:分)?/;

const ymdSlashOrDashHm = /(\d{4})[-\/]?(\d{1,2})[-\/]?(\d{1,2})\s+(\d{1,2}):(\d{2})/;

const mdJpHm = /(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*(?:(午前|午後)\s*)?(\d{1,2})(?:[:：時](\d{1,2}))?\s*(?:分)?/;

function buildDateFromParts(parts) {
  const now = utcToZonedTime(new Date(), timezone);
  let { year, month, day, hour = 0, minute = 0, ampm } = parts;
  if (!year) year = now.getFullYear();
  // AM/PM adjust
  if (ampm) {
    if (ampm === '午後' && hour < 12) hour += 12;
    if (ampm === '午前' && hour === 12) hour = 0;
  }
  // month is 1-12, JS wants 0-11
  const candidate = new Date(year, month - 1, day, hour, minute, 0, 0);
  // Convert from local TZ to UTC to keep consistent interpretation
  const utcDate = zonedTimeToUtc(candidate, timezone);
  // If year was omitted and the time has already passed, assume next year
  if (!parts.year) {
    const nowUtc = new Date();
    if (utcDate < nowUtc) {
      const candidateNext = new Date(year + 1, month - 1, day, hour, minute, 0, 0);
      return zonedTimeToUtc(candidateNext, timezone);
    }
  }
  return utcDate;
}

function extractDateTime(text) {
  if (!text) return null;

  // 1) Labeled ISO-like
  for (const re of isoLikeWithLabel) {
    const m = text.match(re);
    if (m && m[1]) {
      const s = m[1].replace(' ', 'T');
      const dt = parseISO(s);
      if (!isNaN(dt)) return dt;
    }
  }

  // 2) ISO-like anywhere
  {
    const m = text.match(isoLike);
    if (m && m[1]) {
      const s = m[1].replace(' ', 'T');
      const dt = parseISO(s);
      if (!isNaN(dt)) return dt;
    }
  }

  // 3) 2025/9/30 18:00 or 2025-9-30 18:00
  {
    const m = text.match(ymdSlashOrDashHm);
    if (m) {
      const year = parseInt(m[1], 10);
      const month = parseInt(m[2], 10);
      const day = parseInt(m[3], 10);
      const hour = parseInt(m[4], 10);
      const minute = parseInt(m[5], 10);
      return buildDateFromParts({ year, month, day, hour, minute });
    }
  }

  // 4) 2025年9月30日 18時00分 / 午後7時30分
  {
    const m = text.match(jpFullYmdHm);
    if (m) {
      const year = m[1] ? parseInt(m[1], 10) : undefined;
      const month = parseInt(m[2], 10);
      const day = parseInt(m[3], 10);
      const ampm = m[4] || undefined;
      const hour = parseInt(m[5], 10);
      const minute = m[6] ? parseInt(m[6], 10) : 0;
      return buildDateFromParts({ year, month, day, hour, minute, ampm });
    }
  }

  // 5) 9月30日 18時 / 午前7:30 （年省略）
  {
    const m = text.match(mdJpHm);
    if (m) {
      const month = parseInt(m[1], 10);
      const day = parseInt(m[2], 10);
      const ampm = m[3] || undefined;
      const hour = parseInt(m[4], 10);
      const minute = m[5] ? parseInt(m[5], 10) : 0;
      return buildDateFromParts({ month, day, hour, minute, ampm });
    }
  }

  return null;
}

function isOneWeekBefore(now, targetDate) {
  const weekBefore = subWeeks(targetDate, 1);
  // Remind when now is within the same day as weekBefore (in local tz)
  const zonedNow = utcToZonedTime(now, timezone);
  const zonedWeekBefore = utcToZonedTime(weekBefore, timezone);
  const start = new Date(zonedWeekBefore);
  start.setHours(0, 0, 0, 0);
  const end = new Date(zonedWeekBefore);
  end.setHours(23, 59, 59, 999);
  return isWithinInterval(zonedNow, { start, end });
}

function isOneDayBefore(now, targetDate) {
  const dayBefore = subDays(targetDate, 1);
  const zonedNow = utcToZonedTime(now, timezone);
  const zonedDayBefore = utcToZonedTime(dayBefore, timezone);
  const start = new Date(zonedDayBefore);
  start.setHours(0, 0, 0, 0);
  const end = new Date(zonedDayBefore);
  end.setHours(23, 59, 59, 999);
  return isWithinInterval(zonedNow, { start, end });
}

function isThreeHoursBefore(now, targetDate) {
  // Use a window to handle periodic runs. Default window 20 minutes.
  const threeHoursBefore = subHours(targetDate, 3);
  const zonedThreeHoursBefore = utcToZonedTime(threeHoursBefore, timezone);
  const start = new Date(zonedThreeHoursBefore);
  const end = new Date(zonedThreeHoursBefore);
  end.setMinutes(end.getMinutes() + 20);
  const zonedNow = utcToZonedTime(now, timezone);
  return isWithinInterval(zonedNow, { start, end });
}

async function fetchChannelMessages(channel) {
  const messages = [];
  let cursor;
  do {
    const res = await client.conversations.history({
      channel,
      cursor,
      limit: 200
    });
    messages.push(...(res.messages || []));
    cursor = res.response_metadata?.next_cursor;
  } while (cursor);
  return messages;
}

async function hasPostedReminder(threadTs, marker) {
  let cursor;
  do {
    const res = await client.conversations.replies({
      channel: channelId,
      ts: threadTs,
      cursor,
      limit: 200
    });
    const replies = res.messages || [];
    if (replies.some((m) => (m.text || '').includes(marker))) return true;
    cursor = res.response_metadata?.next_cursor;
  } while (cursor);
  return false;
}

async function postReminderIfNeeded(message, targetDate) {
  const now = new Date();
  const formattedTarget = format(utcToZonedTime(targetDate, timezone), 'yyyy-MM-dd HH:mm');
  const threadTs = message.thread_ts || message.ts;

  // 1 week
  if (isOneWeekBefore(now, targetDate)) {
    const marker = '[reminder:1w]';
    if (!(await hasPostedReminder(threadTs, marker))) {
      const text = `${marker} リマインド: このイベントは1週間後に予定されています。開催日時: ${formattedTarget} (${timezone})`;
      await client.chat.postMessage({ channel: channelId, text, thread_ts: threadTs });
      return true;
    }
  }

  // 1 day
  if (isOneDayBefore(now, targetDate)) {
    const marker = '[reminder:1d]';
    if (!(await hasPostedReminder(threadTs, marker))) {
      const text = `${marker} リマインド: このイベントは明日に予定されています。開催日時: ${formattedTarget} (${timezone})`;
      await client.chat.postMessage({ channel: channelId, text, thread_ts: threadTs });
      return true;
    }
  }

  // 3 hours
  if (isThreeHoursBefore(now, targetDate)) {
    const marker = '[reminder:3h]';
    if (!(await hasPostedReminder(threadTs, marker))) {
      const text = `${marker} リマインド: このイベントは3時間後に開始します。開催日時: ${formattedTarget} (${timezone})`;
      await client.chat.postMessage({ channel: channelId, text, thread_ts: threadTs });
      return true;
    }
  }

  return false;
}

async function main() {
  const channelInfo = await client.conversations.info({ channel: channelId });
  if (!channelInfo.ok) {
    console.error('Failed to get channel info');
    process.exit(1);
  }

  const messages = await fetchChannelMessages(channelId);
  let remindersSent = 0;

  for (const msg of messages) {
    const text = msg.text || '';
    const dt = extractDateTime(text);
    if (!dt) continue;

    const sent = await postReminderIfNeeded(msg, dt);
    if (sent) remindersSent += 1;
  }

  console.log(`Reminders sent: ${remindersSent}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


