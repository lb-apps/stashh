//
//  Date+ISO8601.swift
//  Stashh
//

import Foundation

extension Date {
    /// Parses an ISO 8601 string with milliseconds (the format the backend uses).
    static func fromISO8601(_ string: String) -> Date? {
        ISO8601DateFormatter.backendFormatter.date(from: string)
    }

    /// Returns the date formatted as an ISO 8601 string for display.
    var iso8601String: String {
        ISO8601DateFormatter.backendFormatter.string(from: self)
    }

    /// Returns a friendly relative time string (e.g. "2 hours ago").
    var relativeFormatted: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter.localizedString(for: self, relativeTo: .now)
    }
}

private extension ISO8601DateFormatter {
    // `ISO8601DateFormatter` is a reference type that Apple does not mark
    // `Sendable`, but its `date(from:)` / `string(from:)` methods are
    // documented as thread-safe once the formatter is configured. We only
    // read from the shared instance, so silencing the concurrency check is
    // safe here.
    nonisolated(unsafe) static let backendFormatter: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
}
