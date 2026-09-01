//
//  ExplorePlacePinView.swift
//  Stashh
//

import SwiftUI

// MARK: - ExplorePlacePinView

/// Pill-shaped map pin carrying a category emoji plus the place's key metadata
/// — rating, price level, distance — with an iMessage-style tail that points
/// at the coordinate.
///
/// The place's **name** is intentionally absent: `Annotation(title:coordinate:)`
/// in `ExploreView` surfaces it through MapKit's native label treatment, which
/// keeps the pill compact and avoids duplicating the same text on the map.
///
/// The tail's tip is the anchor: the surrounding `Annotation(anchor: .bottom)`
/// in `ExploreView` places the map coordinate exactly on `rect.maxY`, which
/// `PillBubbleShape` renders as the tail's sharpest point.
struct ExplorePlacePinView: View {

    // MARK: Inputs

    let category: String?
    /// Google-style 0…5 rating. `nil` hides the rating segment.
    let rating: Double?
    /// Total number of reviews; rendered in a compact "(1.2k)" form alongside
    /// the rating. `nil` or `0` hides the count but keeps the rating.
    let ratingCount: Int?
    /// Google's `price_level` (1…4 → `$`…`$$$$`). Values outside this range,
    /// and `nil`, hide the price segment.
    let priceLevel: Int?
    /// Distance from the user's device location in metres. `nil` hides the
    /// distance segment (e.g. when location permission is denied).
    let distanceM: Double?
    /// Whether this pin is the currently selected place. Selected pins flip to
    /// the cobalt brand fill, invert their text, pop up in scale, and grow a
    /// pulsing neon-green presence ring — the Bump "this one's live" signal.
    var isSelected: Bool = false

    // MARK: Animation

    /// Drives the selected pin's expand-and-fade presence ring. Flipped on in
    /// `onAppear` so the repeating animation starts as soon as the ring exists.
    @State private var ringPulse = false

    // MARK: Layout

    /// Emoji point size — sized so its cap height roughly matches the combined
    /// height of the two metadata lines, letting the emoji act as a visual
    /// anchor on the left without dominating the pill.
    private let emojiSize: CGFloat = 20
    /// Horizontal spacing between the emoji and the stacked metadata column.
    private let interiorSpacing: CGFloat = 7
    /// Vertical spacing between the primary (rating) and secondary
    /// (price + distance) lines. Tight on purpose — the line-height of the
    /// fonts already leaves breathing room.
    private let metadataLineSpacing: CGFloat = 1
    /// Horizontal insets inside the pill.
    private let horizontalPadding: CGFloat = 11
    /// Vertical inset above and below the stacked content.
    private let verticalPadding: CGFloat = 6
    /// How far the tail extends below the pill's bottom edge.
    private let tailDrop: CGFloat = 7
    /// Half-width of the tail's attachment to the pill — controls how
    /// "pointy" the tail reads.
    private let tailAttachHalfWidth: CGFloat = 7

    // MARK: Derived

    private var categoryEmoji: String {
        PlaceCategoryEmoji.emoji(for: category)
    }

    private var ratingText: String? {
        PlaceFormatting.rating(rating)
    }

    private var ratingCountText: String? {
        PlaceFormatting.compactCount(ratingCount)
    }

    private var priceLevelText: String? {
        PlaceFormatting.price(priceLevel)
    }

    private var distanceText: String? {
        PlaceFormatting.distance(distanceM)
    }

    /// Whether any metadata segment should render. When everything is `nil`
    /// the pill collapses to a pure emoji chip rather than showing an empty
    /// padded column.
    private var hasAnyMetadata: Bool {
        hasPrimaryLine || hasSecondaryLine
    }

    /// The primary (top) line holds the rating plus its review count. It's
    /// the piece people scan for first, so it gets the heavier weight.
    private var hasPrimaryLine: Bool {
        ratingText != nil
    }

    /// The secondary (bottom) line holds price and distance — context that
    /// matters once a place has caught your eye.
    private var hasSecondaryLine: Bool {
        priceLevelText != nil || distanceText != nil
    }

    private var accessibilityTitle: String {
        var parts: [String] = []
        if let raw = category?.trimmingCharacters(in: .whitespacesAndNewlines),
           !raw.isEmpty {
            parts.append(raw.replacingOccurrences(of: "_", with: " "))
        }
        if let ratingText {
            if let ratingCountText {
                parts.append("rating \(ratingText), \(ratingCountText) reviews")
            } else {
                parts.append("rating \(ratingText)")
            }
        }
        if let priceLevel, (1...4).contains(priceLevel) {
            parts.append("price level \(priceLevel) of 4")
        }
        if let distanceText {
            parts.append(distanceText)
        }
        return parts.joined(separator: ", ")
    }

    // MARK: Theming

    /// Strong text (rating value, price) — inverts to white on the cobalt
    /// selected fill, stays near-black on the white resting pill.
    private var strongTextColor: Color {
        isSelected ? AppColor.labelOnBrand : AppColor.label
    }

    /// Secondary text (review count, distance) — softened white when selected.
    private var mutedTextColor: Color {
        isSelected ? AppColor.labelOnBrand.opacity(0.85) : AppColor.labelSecondary
    }

    /// The faint separator dot between price and distance.
    private var separatorTextColor: Color {
        isSelected ? AppColor.labelOnBrand.opacity(0.7) : AppColor.labelTertiary
    }

    // MARK: Body

    var body: some View {
        HStack(alignment: .center, spacing: hasAnyMetadata ? interiorSpacing : 0) {
            Text(categoryEmoji)
                .font(.system(size: emojiSize))
                .fixedSize()

            if hasAnyMetadata {
                metadataStack
            }
        }
        .padding(.horizontal, horizontalPadding)
        .padding(.vertical, verticalPadding)
        // Reserve the tail's slice of the background frame without letting
        // content descend into it.
        .padding(.bottom, tailDrop)
        .background(pillBackground)
        // The presence ring sits behind the pill so it haloes outward without
        // pushing the layout around.
        .background(presenceRing)
        .scaleEffect(isSelected ? 1.12 : 1.0)
        .animation(Motion.pinPop, value: isSelected)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(accessibilityTitle)
        .accessibilityAddTraits(.isImage)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    // MARK: Metadata stack

    /// Two-row column sitting to the right of the emoji:
    ///   • **Primary line** — rating + review count (what people scan for
    ///     first, rendered with heavier weight and a yellow star).
    ///   • **Secondary line** — price and distance joined by " · " (context
    ///     that matters once a place has caught your eye).
    ///
    /// When a line has no content it's omitted entirely rather than padded
    /// out, so a price-less park collapses to a single-line pill instead of
    /// growing an empty row.
    private var metadataStack: some View {
        VStack(alignment: .leading, spacing: metadataLineSpacing) {
            if hasPrimaryLine {
                primaryLine
            }
            if hasSecondaryLine {
                secondaryLine
            }
        }
        // Keep the column at its intrinsic width so the surrounding pill
        // hugs the content instead of stretching to fill its parent.
        .fixedSize(horizontal: true, vertical: false)
    }

    /// `★ 4.6 (1.2k)` — the star, the rating value, and the optional review
    /// count composed as a single `Text` so the baseline stays rock-solid and
    /// the run never line-breaks between star and number.
    private var primaryLine: Text {
        var run = Text("★ ")
            .foregroundStyle(Color(.systemYellow))
            .font(.system(size: 11, weight: .semibold))
        + Text(ratingText ?? "")
            .foregroundStyle(strongTextColor)
            .font(.system(size: 12, weight: .semibold))

        if let ratingCountText {
            run = run
            + Text(" (\(ratingCountText))")
                .foregroundStyle(mutedTextColor)
                .font(.system(size: 11, weight: .regular))
        }
        return run
    }

    /// `$$ · 450 m` — price and distance joined by a spaced middle dot.
    /// Single-piece variants (distance-only, price-only) drop the separator
    /// automatically.
    private var secondaryLine: Text {
        let separator = Text(" · ")
            .foregroundStyle(separatorTextColor)
            .font(.system(size: 11, weight: .regular))

        var composed: Text?

        func append(_ next: Text) {
            if let existing = composed {
                composed = existing + separator + next
            } else {
                composed = next
            }
        }

        if let priceLevelText {
            append(
                Text(priceLevelText)
                    .foregroundStyle(strongTextColor)
                    .font(.system(size: 11, weight: .semibold))
            )
        }

        if let distanceText {
            append(
                Text(distanceText)
                    .foregroundStyle(mutedTextColor)
                    .font(.system(size: 11, weight: .regular))
            )
        }

        return composed ?? Text("")
    }

    // MARK: Subviews

    private var pillBackground: some View {
        let shape = PillBubbleShape(
            tailDrop: tailDrop,
            tailAttachHalfWidth: tailAttachHalfWidth
        )
        return shape
            .fill(pillFill)
            .overlay {
                shape.stroke(pillStroke, lineWidth: isSelected ? 1 : 0.75)
            }
            .shadow(color: .black.opacity(isSelected ? 0.28 : 0.18), radius: isSelected ? 9 : 6, y: isSelected ? 5 : 3)
            .shadow(color: .black.opacity(0.06), radius: 1, y: 1)
    }

    /// White-with-personality at rest; full cobalt brand gradient when selected.
    private var pillFill: LinearGradient {
        if isSelected {
            return LinearGradient(
                colors: [ColorPalette.Blue.shade400, ColorPalette.Blue.shade500],
                startPoint: .top,
                endPoint: .bottom
            )
        }
        // Crisp white at the top fading to a hint of brand blue at the
        // bottom — reads as "white pill with personality", not a blue chip.
        return LinearGradient(
            colors: [.white, ColorPalette.Blue.shade50],
            startPoint: .top,
            endPoint: .bottom
        )
    }

    private var pillStroke: Color {
        isSelected ? ColorPalette.Blue.shade600 : ColorPalette.Blue.shade100
    }

    /// Cobalt presence ring behind the selected pill. It expands outward and
    /// fades on a loop — the Bump "live" pulse, in a lighter shade of the pill's
    /// own brand hue so the halo reads as the pin glowing rather than a clashing
    /// accent. Sized to the pill body (tail excluded) for a clean capsule.
    @ViewBuilder
    private var presenceRing: some View {
        if isSelected {
            Capsule()
                .stroke(ColorPalette.Blue.shade300, lineWidth: 3)
                .padding(.bottom, tailDrop)
                .scaleEffect(ringPulse ? 1.35 : 0.96)
                .opacity(ringPulse ? 0 : 0.9)
                .animation(
                    .easeOut(duration: 1.4).repeatForever(autoreverses: false),
                    value: ringPulse
                )
                .onAppear { ringPulse = true }
                .onDisappear { ringPulse = false }
                .allowsHitTesting(false)
        }
    }
}

// MARK: - PillBubbleShape

/// A fully-rounded pill whose bottom edge is interrupted by a small
/// iMessage-style tail in the centre. The tail's tip sits at `rect.maxY`,
/// so the shape can be used as a `.background` on a view whose frame
/// already reserves `tailDrop` points at the bottom — dropping an
/// `Annotation(anchor: .bottom)` on this shape lands the map coordinate
/// exactly on the point of the tail.
private struct PillBubbleShape: Shape {

    /// Vertical distance from the pill's bottom edge to the tail tip.
    var tailDrop: CGFloat
    /// Half-width of the tail's attachment to the pill's bottom edge.
    /// Smaller values → sharper, pointier tail; larger values → softer bump.
    var tailAttachHalfWidth: CGFloat

    func path(in rect: CGRect) -> Path {
        var path = Path()

        // The pill occupies the top `rect.height - tailDrop`; the tail sits
        // in the remaining strip below it.
        let pillRect = CGRect(
            x: rect.minX,
            y: rect.minY,
            width: rect.width,
            height: rect.height - tailDrop
        )
        // Full-pill radius, clamped so absurdly narrow/short frames can't
        // produce a degenerate shape.
        let radius = min(pillRect.height / 2, pillRect.width / 2)
        let pillBottom = pillRect.maxY

        // Traverse the outline visually clockwise. In SwiftUI's y-down
        // coordinate space, `clockwise: false` corresponds to a visually
        // clockwise sweep for `addArc`.

        // Top edge (starting just past the top-left corner).
        path.move(to: CGPoint(x: pillRect.minX + radius, y: pillRect.minY))
        path.addLine(to: CGPoint(x: pillRect.maxX - radius, y: pillRect.minY))

        // Top-right corner.
        path.addArc(
            center: CGPoint(x: pillRect.maxX - radius, y: pillRect.minY + radius),
            radius: radius,
            startAngle: .degrees(-90),
            endAngle: .degrees(0),
            clockwise: false
        )

        // Right edge (zero-length when the pill is fully rounded).
        path.addLine(to: CGPoint(x: pillRect.maxX, y: pillBottom - radius))

        // Bottom-right corner.
        path.addArc(
            center: CGPoint(x: pillRect.maxX - radius, y: pillBottom - radius),
            radius: radius,
            startAngle: .degrees(0),
            endAngle: .degrees(90),
            clockwise: false
        )

        // Bottom edge up to the tail's right attachment.
        path.addLine(
            to: CGPoint(x: rect.midX + tailAttachHalfWidth, y: pillBottom)
        )

        // Tail: two quadratic curves meeting at the tip. The control points
        // pull the curves inward so the tail reads as a soft, slightly
        // curved triangle rather than a hard V.
        path.addQuadCurve(
            to: CGPoint(x: rect.midX, y: rect.maxY),
            control: CGPoint(
                x: rect.midX + tailAttachHalfWidth * 0.35,
                y: pillBottom + tailDrop * 0.85
            )
        )
        path.addQuadCurve(
            to: CGPoint(x: rect.midX - tailAttachHalfWidth, y: pillBottom),
            control: CGPoint(
                x: rect.midX - tailAttachHalfWidth * 0.35,
                y: pillBottom + tailDrop * 0.85
            )
        )

        // Bottom edge from the tail's left attachment to the bottom-left corner.
        path.addLine(to: CGPoint(x: pillRect.minX + radius, y: pillBottom))

        // Bottom-left corner.
        path.addArc(
            center: CGPoint(x: pillRect.minX + radius, y: pillBottom - radius),
            radius: radius,
            startAngle: .degrees(90),
            endAngle: .degrees(180),
            clockwise: false
        )

        // Left edge (zero-length when the pill is fully rounded).
        path.addLine(to: CGPoint(x: pillRect.minX, y: pillRect.minY + radius))

        // Top-left corner, closing the loop.
        path.addArc(
            center: CGPoint(x: pillRect.minX + radius, y: pillRect.minY + radius),
            radius: radius,
            startAngle: .degrees(180),
            endAngle: .degrees(270),
            clockwise: false
        )

        path.closeSubpath()
        return path
    }
}

// MARK: - Preview

#Preview("On map tile") {
    ZStack {
        LinearGradient(
            colors: [ColorPalette.Gray.shade100, ColorPalette.Gray.shade200],
            startPoint: .top,
            endPoint: .bottom
        )
        .ignoresSafeArea()

        VStack(spacing: Spacing.xLarge) {
            // Full metadata.
            ExplorePlacePinView(
                category: "cafe",
                rating: 4.6,
                ratingCount: 1_247,
                priceLevel: 2,
                distanceM: 145
            )
            // High count abbreviates to "3.4k"; long distance in kilometres.
            ExplorePlacePinView(
                category: "pizza_restaurant",
                rating: 4.2,
                ratingCount: 3_412,
                priceLevel: 3,
                distanceM: 2_400
            )
            // Missing price — segment and its separator drop silently.
            ExplorePlacePinView(
                category: "bar",
                rating: 4.9,
                ratingCount: 89,
                priceLevel: nil,
                distanceM: 800
            )
            // Rating-less park — primary line collapses; distance-only
            // secondary survives on a single-line pill.
            ExplorePlacePinView(
                category: "park",
                rating: nil,
                ratingCount: nil,
                priceLevel: nil,
                distanceM: 12_000
            )
            // Rating-only museum — secondary line collapses; the pill reads
            // as a single-line chip with just the star + value.
            ExplorePlacePinView(
                category: "museum",
                rating: 4.4,
                ratingCount: 512,
                priceLevel: nil,
                distanceM: nil
            )
            // Emoji-only fallback.
            ExplorePlacePinView(
                category: nil,
                rating: nil,
                ratingCount: nil,
                priceLevel: nil,
                distanceM: nil
            )
            // Selected state — cobalt fill, inverted text, pulsing live ring.
            ExplorePlacePinView(
                category: "cafe",
                rating: 4.6,
                ratingCount: 1_247,
                priceLevel: 2,
                distanceM: 145,
                isSelected: true
            )
        }
    }
}
