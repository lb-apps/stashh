//
//  PlaceFormatting.swift
//  Stashh
//

import Foundation

// MARK: - PlaceFormatting

/// Locale-aware string formatting for a place's headline metadata — rating,
/// review count, price level, distance. Shared between the map pin
/// (`ExplorePlacePinView`) and the detail sheet (`PlaceDetailSheet`) so the
/// numbers read identically wherever they appear.
enum PlaceFormatting {

    // MARK: Rating

    /// One-decimal, locale-aware rating ("4,6" in tr_TR, "4.6" in en_US).
    /// Returns `nil` for missing / non-positive ratings so callers can hide
    /// the segment entirely.
    static func rating(_ value: Double?) -> String? {
        guard let value, value.isFinite, value > 0 else { return nil }
        return ratingFormatter.string(from: NSNumber(value: value))
    }

    // MARK: Review count

    /// Compact review count: `nil`/0 → hidden, < 1 000 → "234",
    /// < 1 000 000 → "1.2k", else "3.4M".
    ///
    /// Hand-rolled because `NumberFormatter.Style.compactName` renders with a
    /// leading space in some locales ("1.2 k"), which reads as two words.
    static func compactCount(_ value: Int?) -> String? {
        guard let value, value > 0 else { return nil }
        switch value {
        case ..<1_000:
            return "\(value)"
        case ..<1_000_000:
            return "\(trimmedOneDecimal(Double(value) / 1_000))k"
        default:
            return "\(trimmedOneDecimal(Double(value) / 1_000_000))M"
        }
    }

    // MARK: Price

    /// `$`…`$$$$` for Google's 1…4 price levels. Out-of-range values (0,
    /// negatives, > 4) and `nil` return `nil` rather than guessing.
    static func price(_ level: Int?) -> String? {
        guard let level, (1...4).contains(level) else { return nil }
        return String(repeating: "$", count: level)
    }

    // MARK: Distance

    /// Localised natural-scale distance ("145 m", "2,4 km"). `nil`/negative
    /// returns `nil`.
    static func distance(_ meters: Double?) -> String? {
        guard let meters, meters.isFinite, meters >= 0 else { return nil }
        return distanceFormatter.string(
            from: Measurement(value: meters, unit: UnitLength.meters)
        )
    }

    // MARK: Saved date

    /// Relative phrasing of when a place was saved ("Saved 3 days ago"). Parses
    /// the backend's ISO8601 `savedAt`; returns `nil` if it can't be parsed so
    /// the caller hides the row.
    static func relativeSavedAt(_ iso: String) -> String? {
        guard let date = isoParser.date(from: iso) ?? isoParserNoFraction.date(from: iso) else {
            return nil
        }
        return "Saved \(relativeFormatter.localizedString(for: date, relativeTo: .now))"
    }

    // MARK: Primitives

    private static func trimmedOneDecimal(_ value: Double) -> String {
        // "1.2" when the decimal is meaningful, "12" when it isn't — avoids
        // the visual noise of "12.0k" while preserving "1.2k".
        let rounded = (value * 10).rounded() / 10
        if rounded == rounded.rounded() {
            return String(Int(rounded))
        } else {
            return String(format: "%.1f", rounded)
        }
    }

    // `nonisolated(unsafe)`: these formatters are configured once and then only
    // read (`string(from:)`), so the shared instances are safe to use across
    // isolation domains despite the types themselves being non-`Sendable`.
    nonisolated(unsafe) private static let ratingFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 1
        formatter.maximumFractionDigits = 1
        return formatter
    }()

    nonisolated(unsafe) private static let distanceFormatter: MeasurementFormatter = {
        let formatter = MeasurementFormatter()
        formatter.unitOptions = .naturalScale
        formatter.unitStyle = .medium
        formatter.numberFormatter.maximumFractionDigits = 1
        return formatter
    }()

    nonisolated(unsafe) private static let relativeFormatter: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter
    }()

    // Two parsers: Postgres `created_at` may or may not carry fractional seconds.
    nonisolated(unsafe) private static let isoParser: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()

    nonisolated(unsafe) private static let isoParserNoFraction: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        return formatter
    }()
}
