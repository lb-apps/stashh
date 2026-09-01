//
//  OpeningHours.swift
//  Stashh
//

import Foundation

// MARK: - OpeningHours

/// Derives presentation-ready opening-hours information from a place's raw
/// Google `periods`. The backend deliberately strips Google's `openNow`, so
/// "open now" is computed here against the device clock.
///
/// Google encodes weekdays as 0=Sunday … 6=Saturday, and a 24-hour venue as a
/// single period with no `close`. Periods may close on a *later* weekday than
/// they open (a bar open 18:00 → 02:00), which the week-of-minutes arithmetic
/// below handles by letting the close index roll past the open index.
enum OpeningHours {

    private static let minutesPerDay = 24 * 60
    private static let minutesPerWeek = 7 * 24 * 60

    // MARK: Open now

    /// `true`/`false` if hours are known, `nil` when `periods` is empty/absent.
    static func isOpen(_ periods: [OpeningPeriod]?, at date: Date = .now, calendar: Calendar = .current) -> Bool? {
        guard let periods, !periods.isEmpty else { return nil }
        if isAlwaysOpen(periods) { return true }

        let now = minuteOfWeek(for: date, calendar: calendar)
        for period in periods {
            guard let close = period.close else { continue }
            let start = minuteOfWeek(period.open)
            var end = minuteOfWeek(close)
            // A close that lands at or before the open rolls into the next week.
            if end <= start { end += minutesPerWeek }
            // Check both `now` and `now + 1 week` so a span that wrapped past
            // Saturday→Sunday still matches an early-week instant.
            if (now >= start && now < end) || (now + minutesPerWeek >= start && now + minutesPerWeek < end) {
                return true
            }
        }
        return false
    }

    // MARK: Weekly schedule

    /// One row per weekday, ordered from the locale's first weekday. `ranges`
    /// is empty for a closed day.
    struct DaySchedule: Identifiable, Sendable, Hashable {
        /// 0=Sunday … 6=Saturday (Google's indexing).
        let weekday: Int
        /// Localised time ranges, e.g. `["09:00 – 17:00"]`, or `["Open 24 hours"]`.
        let ranges: [String]
        var id: Int { weekday }
        var isClosed: Bool { ranges.isEmpty }
    }

    static func weeklySchedule(_ periods: [OpeningPeriod]?, calendar: Calendar = .current) -> [DaySchedule] {
        guard let periods, !periods.isEmpty else { return [] }

        let allDay = isAlwaysOpen(periods)
        var byDay: [Int: [String]] = [:]
        if !allDay {
            for period in periods {
                let day = period.open.day
                guard let close = period.close else {
                    byDay[day, default: []].append(twentyFourHours)
                    continue
                }
                let range = "\(format(period.open)) – \(format(close))"
                byDay[day, default: []].append(range)
            }
        }

        // Reorder Sun…Sat into the locale's week (firstWeekday is 1-based,
        // 1=Sunday), so tr_TR leads with Monday and en_US with Sunday.
        let start = calendar.firstWeekday - 1
        return (0..<7).map { offset in
            let day = (start + offset) % 7
            return DaySchedule(weekday: day, ranges: allDay ? [twentyFourHours] : (byDay[day] ?? []))
        }
    }

    /// Today's formatted hours — the joined ranges, or `nil` when closed today
    /// / hours unknown. Drives the collapsed hours row.
    static func todayHours(_ periods: [OpeningPeriod]?, at date: Date = .now, calendar: Calendar = .current) -> String? {
        guard let periods, !periods.isEmpty else { return nil }
        let today = calendar.component(.weekday, from: date) - 1
        let row = weeklySchedule(periods, calendar: calendar).first { $0.weekday == today }
        guard let row, !row.isClosed else { return nil }
        return row.ranges.joined(separator: ", ")
    }

    /// Localised full weekday name (e.g. "Monday" / "Pazartesi") for a row.
    static func weekdaySymbol(_ weekday: Int, calendar: Calendar = .current) -> String {
        let symbols = calendar.weekdaySymbols // index 0 = Sunday
        guard symbols.indices.contains(weekday) else { return "" }
        return symbols[weekday]
    }

    /// True when today's row is the one the user is looking at.
    static func isToday(_ weekday: Int, at date: Date = .now, calendar: Calendar = .current) -> Bool {
        calendar.component(.weekday, from: date) - 1 == weekday
    }

    // MARK: Primitives

    private static let twentyFourHours = "Open 24 hours"

    /// A lone period with no close is Google's 24/7 marker.
    private static func isAlwaysOpen(_ periods: [OpeningPeriod]) -> Bool {
        periods.count == 1 && periods[0].close == nil
    }

    private static func minuteOfWeek(_ point: TimePoint) -> Int {
        point.day * minutesPerDay + point.hour * 60 + point.minute
    }

    private static func minuteOfWeek(for date: Date, calendar: Calendar) -> Int {
        let comps = calendar.dateComponents([.weekday, .hour, .minute], from: date)
        let day = (comps.weekday ?? 1) - 1
        return day * minutesPerDay + (comps.hour ?? 0) * 60 + (comps.minute ?? 0)
    }

    private static func format(_ point: TimePoint) -> String {
        var comps = DateComponents()
        comps.hour = point.hour
        comps.minute = point.minute
        let date = Calendar.current.date(from: comps) ?? .now
        return timeFormatter.string(from: date)
    }

    // `nonisolated(unsafe)`: configured once, then only read via `string(from:)`
    // — safe to share across isolation domains despite `DateFormatter` being
    // non-`Sendable`. Mirrors `PlaceFormatting`'s formatter handling.
    nonisolated(unsafe) private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.timeStyle = .short
        formatter.dateStyle = .none
        return formatter
    }()
}
