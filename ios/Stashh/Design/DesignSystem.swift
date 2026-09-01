//
//  DesignSystem.swift
//  Stashh
//
//  Created by Emirhan Erdogan on 26/03/2026.
//

import SwiftUI

// MARK: - TextStyle

enum TextStyle {

    // MARK: Display

    /// SF Pro · largeTitle · black (extraLargeTitle is macOS-only)
    static let displayLarge: Font = .system(.largeTitle, design: .rounded, weight: .black)
    /// SF Pro · largeTitle · black
    static let displayMedium: Font = .system(.largeTitle, weight: .black)
    /// SF Pro · title · black
    static let displaySmall: Font = .system(.title, weight: .black)

    // MARK: Headline

    /// SF Pro · title · bold
    static let headlineLarge: Font = .system(.title, weight: .bold)
    /// SF Pro · title2 · bold
    static let headlineMedium: Font = .system(.title2, weight: .bold)
    /// SF Pro · title3 · bold
    static let headlineSmall: Font = .system(.title3, weight: .bold)

    // MARK: Title

    /// SF Pro · headline · semibold
    static let titleLarge: Font = .system(.headline, weight: .semibold)
    /// SF Pro · callout · semibold
    static let titleMedium: Font = .system(.callout, weight: .semibold)
    /// SF Pro · subheadline · semibold
    static let titleSmall: Font = .system(.subheadline, weight: .semibold)

    // MARK: Body

    /// SF Pro · body · regular
    static let bodyLarge: Font = .system(.body, weight: .regular)
    /// SF Pro · subheadline · regular
    static let bodyMedium: Font = .system(.subheadline, weight: .regular)
    /// SF Pro · footnote · regular
    static let bodySmall: Font = .system(.footnote, weight: .regular)

    // MARK: Caption

    /// SF Pro · footnote · medium
    static let captionLarge: Font = .system(.footnote, weight: .medium)
    /// SF Pro · caption · medium
    static let captionMedium: Font = .system(.caption, weight: .medium)
    /// SF Pro · caption2 · medium
    static let captionSmall: Font = .system(.caption2, weight: .medium)
}

// MARK: - ColorPalette

enum ColorPalette {

    // MARK: Blue — Primary Brand

    enum Blue {
        /// #EDF2FF
        static let shade50 = Color(hex: 0xEDF2FF)
        /// #D6E0FF
        static let shade100 = Color(hex: 0xD6E0FF)
        /// #ADC1FF
        static let shade200 = Color(hex: 0xADC1FF)
        /// #7E9EFF
        static let shade300 = Color(hex: 0x7E9EFF)
        /// #4B72FF
        static let shade400 = Color(hex: 0x4B72FF)
        /// #0138FF
        static let shade500 = Color(hex: 0x0138FF)
        /// #012DD6
        static let shade600 = Color(hex: 0x012DD6)
        /// #0124AD
        static let shade700 = Color(hex: 0x0124AD)
        /// #021B85
        static let shade800 = Color(hex: 0x021B85)
        /// #03125E
        static let shade900 = Color(hex: 0x03125E)
    }

    // MARK: Purple — Secondary Brand

    enum Purple {
        /// #F1EFFE
        static let shade50 = Color(hex: 0xF1EFFE)
        /// #E0DBFD
        static let shade100 = Color(hex: 0xE0DBFD)
        /// #C4BBFB
        static let shade200 = Color(hex: 0xC4BBFB)
        /// #A89AFC
        static let shade300 = Color(hex: 0xA89AFC)
        /// #9083FC
        static let shade400 = Color(hex: 0x9083FC)
        /// #7C6DFC
        static let shade500 = Color(hex: 0x7C6DFC)
        /// #6558D9
        static let shade600 = Color(hex: 0x6558D9)
        /// #4F44B6
        static let shade700 = Color(hex: 0x4F44B6)
        /// #3B3293
        static let shade800 = Color(hex: 0x3B3293)
        /// #2A2272
        static let shade900 = Color(hex: 0x2A2272)
    }

    // MARK: Gray — Cool-tinted Neutral

    enum Gray {
        /// #F8F9FB
        static let shade50 = Color(hex: 0xF8F9FB)
        /// #F1F3F7
        static let shade100 = Color(hex: 0xF1F3F7)
        /// #E2E5EB
        static let shade200 = Color(hex: 0xE2E5EB)
        /// #CDD2DA
        static let shade300 = Color(hex: 0xCDD2DA)
        /// #9CA3B0
        static let shade400 = Color(hex: 0x9CA3B0)
        /// #6B7280
        static let shade500 = Color(hex: 0x6B7280)
        /// #4B5563
        static let shade600 = Color(hex: 0x4B5563)
        /// #374151
        static let shade700 = Color(hex: 0x374151)
        /// #1F2937
        static let shade800 = Color(hex: 0x1F2937)
        /// #111827
        static let shade900 = Color(hex: 0x111827)
    }
}

// MARK: - AppColor

enum AppColor {

    // MARK: Background

    /// White — primary surface
    static let background: Color = .white
    /// Gray/50 — secondary surface
    static let backgroundSecondary: Color = ColorPalette.Gray.shade50
    /// Gray/100 — tertiary surface
    static let backgroundTertiary: Color = ColorPalette.Gray.shade100
    /// Gray/50 — grouped content surface
    static let backgroundGrouped: Color = ColorPalette.Gray.shade50
    /// White — secondary grouped surface
    static let backgroundGroupedSecondary: Color = .white
    /// Gray/100 — tertiary grouped surface
    static let backgroundGroupedTertiary: Color = ColorPalette.Gray.shade100
    /// Blue/50 — subtle brand tinted surface
    static let backgroundBrandSubtle: Color = ColorPalette.Blue.shade50
    /// Blue/500 — bold brand surface
    static let backgroundBrand: Color = ColorPalette.Blue.shade500
    /// Purple/50 — subtle accent tinted surface
    static let backgroundAccentSubtle: Color = ColorPalette.Purple.shade50
    /// Purple/500 — bold accent surface
    static let backgroundAccent: Color = ColorPalette.Purple.shade500

    // MARK: Fill

    /// Gray/200 — primary interactive fill
    static let fill: Color = ColorPalette.Gray.shade200
    /// Gray/100 — secondary interactive fill
    static let fillSecondary: Color = ColorPalette.Gray.shade100
    /// Gray/50 — tertiary interactive fill
    static let fillTertiary: Color = ColorPalette.Gray.shade50
    /// Gray/25 — quaternary interactive fill
    static let fillQuaternary: Color = Color(hex: 0xFCFCFD)
    /// Blue/500 — brand fill
    static let fillBrand: Color = ColorPalette.Blue.shade500
    /// Blue/100 — subtle brand fill
    static let fillBrandSubtle: Color = ColorPalette.Blue.shade100
    /// Purple/500 — accent fill
    static let fillAccent: Color = ColorPalette.Purple.shade500
    /// Purple/100 — subtle accent fill
    static let fillAccentSubtle: Color = ColorPalette.Purple.shade100

    // MARK: Label

    /// Gray/900 — primary text and icons
    static let label: Color = ColorPalette.Gray.shade900
    /// Gray/600 — secondary text and icons
    static let labelSecondary: Color = ColorPalette.Gray.shade600
    /// Gray/400 — tertiary text and icons
    static let labelTertiary: Color = ColorPalette.Gray.shade400
    /// Gray/300 — quaternary text and icons
    static let labelQuaternary: Color = ColorPalette.Gray.shade300
    /// Gray/300 — placeholder text
    static let labelPlaceholder: Color = ColorPalette.Gray.shade300
    /// Blue/500 — brand colored text
    static let labelBrand: Color = ColorPalette.Blue.shade500
    /// Purple/500 — accent colored text
    static let labelAccent: Color = ColorPalette.Purple.shade500
    /// White — text on brand/accent surfaces
    static let labelOnBrand: Color = .white

    // MARK: Separator

    /// Gray/200 — default divider
    static let separator: Color = ColorPalette.Gray.shade200
    /// Gray/300 — opaque divider
    static let separatorOpaque: Color = ColorPalette.Gray.shade300
    /// Blue/100 — brand tinted divider
    static let separatorBrand: Color = ColorPalette.Blue.shade100

    // MARK: Presence

    /// Neon presence green (DESIGN.md tertiary `#22FF00`, tamed a touch for
    /// legibility over the muted basemap). The Bump "live" signal — used as
    /// the pulsing ring on the selected map pin.
    static let live: Color = Color(hex: 0x18E000)
}

// MARK: - Motion

/// Shared animation curves so the pin, the camera, and the sheet all move
/// with the same Bump personality instead of drifting toward generic eases.
///
/// The signature spring overshoots slightly — the DESIGN.md
/// `cubic-bezier(0.34, 1.56, 0.64, 1)` feel — so selected elements snap in
/// with a little life rather than gliding to rest.
enum Motion {
    /// Springy snap with a hint of overshoot. The base curve everything else
    /// is derived from.
    static let spring: Animation = .spring(response: 0.34, dampingFraction: 0.64)
    /// Selecting / deselecting a pin and centring the camera on it.
    static let selection: Animation = spring
    /// The pin's pop when it becomes selected — a touch snappier than
    /// `selection` so the scale change reads as a deliberate beat.
    static let pinPop: Animation = .spring(response: 0.30, dampingFraction: 0.58)
    /// Matches the system sheet's detent presentation curve — critically
    /// damped (no overshoot), ~half a second — so a camera move that runs
    /// alongside a `.sheet` lands in lockstep with it instead of lingering
    /// on a springy tail.
    static let sheet: Animation = .spring(response: 0.5, dampingFraction: 1.0)
}

// MARK: - Spacing

enum Spacing {
    /// 2pt
    static let xxSmall: CGFloat = 2
    /// 4pt
    static let xSmall: CGFloat = 4
    /// 8pt
    static let small: CGFloat = 8
    /// 12pt
    static let medium: CGFloat = 12
    /// 16pt
    static let large: CGFloat = 16
    /// 20pt
    static let xLarge: CGFloat = 20
    /// 24pt
    static let xxLarge: CGFloat = 24
    /// 32pt
    static let xxxLarge: CGFloat = 32
    /// 48pt
    static let xxxxLarge: CGFloat = 48
}

// MARK: - Radius

enum Radius {
    /// 8pt
    static let small: CGFloat = 8
    /// 12pt
    static let medium: CGFloat = 12
    /// 16pt
    static let large: CGFloat = 16
    /// 20pt
    static let xLarge: CGFloat = 20
    /// 24pt
    static let xxLarge: CGFloat = 24
    /// Pill shape / circle
    static let full: CGFloat = 9999
}

// MARK: - Color Extension

extension Color {
    init(hex: UInt, opacity: Double = 1.0) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255.0,
            green: Double((hex >> 8) & 0xFF) / 255.0,
            blue: Double(hex & 0xFF) / 255.0,
            opacity: opacity
        )
    }
}

// MARK: - Preview

#Preview {
    ScrollView {
        VStack(alignment: .leading, spacing: Spacing.large) {
            Group {
                Text("displaySmall").font(TextStyle.displaySmall)
                Text("headlineLarge").font(TextStyle.headlineLarge)
                Text("headlineMedium").font(TextStyle.headlineMedium)
                Text("headlineSmall").font(TextStyle.headlineSmall)
                Text("titleLarge").font(TextStyle.titleLarge)
                Text("titleMedium").font(TextStyle.titleMedium)
                Text("titleSmall").font(TextStyle.titleSmall)
                Text("bodyLarge").font(TextStyle.bodyLarge)
                Text("bodyMedium").font(TextStyle.bodyMedium)
                Text("bodySmall").font(TextStyle.bodySmall)
                Text("captionLarge").font(TextStyle.captionLarge)
                Text("captionMedium").font(TextStyle.captionMedium)
                Text("captionSmall").font(TextStyle.captionSmall)
            }
            .foregroundStyle(AppColor.label)

            Divider()

            HStack(spacing: Spacing.small) {
                ForEach([
                    ColorPalette.Blue.shade500,
                    ColorPalette.Purple.shade500,
                    ColorPalette.Gray.shade500,
                    AppColor.backgroundBrand,
                    AppColor.backgroundAccent,
                ], id: \.self) { color in
                    RoundedRectangle(cornerRadius: Radius.medium)
                        .fill(color)
                        .frame(width: 40, height: 40)
                }
            }
        }
        .padding(Spacing.xxLarge)
        .background(AppColor.background)
    }
}
