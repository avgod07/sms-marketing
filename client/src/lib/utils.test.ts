import { describe, it, expect } from "vitest";
import { formatRelativeTime } from "./utils";

describe("formatRelativeTime", () => {
  it("formats recent times correctly", () => {
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    expect(formatRelativeTime(oneMinuteAgo.toISOString())).toBe("1 minute ago");
    expect(formatRelativeTime(fiveMinutesAgo.toISOString())).toBe(
      "5 minutes ago"
    );
    expect(formatRelativeTime(oneHourAgo.toISOString())).toBe("1 hour ago");
    expect(formatRelativeTime(twoHoursAgo.toISOString())).toBe("2 hours ago");
  });

  it("formats older times correctly", () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    expect(formatRelativeTime(oneDayAgo.toISOString())).toBe("1 day ago");
    expect(formatRelativeTime(threeDaysAgo.toISOString())).toBe("3 days ago");
    expect(formatRelativeTime(oneWeekAgo.toISOString())).toBe("1 week ago");
    expect(formatRelativeTime(twoWeeksAgo.toISOString())).toBe("2 weeks ago");
  });

  it("handles very recent times", () => {
    const now = new Date();
    const thirtySecondsAgo = new Date(now.getTime() - 30 * 1000);

    expect(formatRelativeTime(thirtySecondsAgo.toISOString())).toBe("Just now");
  });

  it("handles very old times", () => {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    const twoYearsAgo = new Date(now.getTime() - 2 * 365 * 24 * 60 * 60 * 1000);

    expect(formatRelativeTime(oneYearAgo.toISOString())).toBe("1 year ago");
    expect(formatRelativeTime(twoYearsAgo.toISOString())).toBe("2 years ago");
  });
});
