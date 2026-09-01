//
//  PlaceDetailView.swift
//  Stashh
//

import SwiftUI

// MARK: - PlaceDetailView

/// The full detail for a saved place. Presentation-agnostic on purpose: it
/// renders the same whether hosted in Explore's `.sheet` or pushed onto a
/// `NavigationStack` from the Library — so it owns **content only** and never
/// sheet detents or its own navigation container.
///
/// Bump personality on native chrome: a photo hero with a live open-now badge,
/// the signature two-tone name, metadata + type chips, an expandable weekly
/// schedule, contact actions, the venue's recommendations, editable notes, and
/// a cobalt Directions pill.
struct PlaceDetailView: View {

    // MARK: Inputs

    let place: Place
    let repository: any PlacesRepositoryProtocol
    /// Distance from the user's device location, computed by the caller (not
    /// the API's query-centre value). `nil` outside a located context.
    let distanceM: Double?

    // MARK: Environment

    @Environment(\.openURL) private var openURL

    // MARK: State

    @State private var photoURLs: [String] = []
    @State private var currentPhotoIndex = 0
    @State private var isLoadingPhotos = true
    @State private var shimmerOffset = false
    @State private var hoursExpanded = false
    @State private var notesDraft: String
    @State private var savedNotes: String
    @State private var isSavingNotes = false

    // MARK: Init

    init(place: Place, repository: any PlacesRepositoryProtocol, distanceM: Double?) {
        self.place = place
        self.repository = repository
        self.distanceM = distanceM
        _notesDraft = State(initialValue: place.notes ?? "")
        _savedNotes = State(initialValue: place.notes ?? "")
    }

    // MARK: Body

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.large) {
                photoCarousel
                header
                metadataRow
                typeChipsRow
                businessStatusNotice
                hoursSection
                contactRow
                recommendationsSection
                notesSection
                infoSection
                actionButtons
            }
            .padding(.bottom, Spacing.xxLarge)
        }
        .background(AppColor.backgroundSecondary)
        .navigationTitle(place.name)
        .navigationBarTitleDisplayMode(.inline)
        .task(id: place.id) { await loadPhotos() }
    }

    // MARK: Card container

    /// Wraps grouped content in a raised white surface — DESIGN's "grouped by
    /// containment": `xl` radius, soft `elev-2` shadow, no internal hairlines.
    /// Local to this file on purpose; the codebase has no card primitive yet and
    /// the plan calls for no premature abstraction.
    private func sectionCard<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: Spacing.small) {
            content()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Spacing.large)
        .background(AppColor.background, in: RoundedRectangle(cornerRadius: Radius.xLarge))
        .shadow(color: Color.black.opacity(0.10), radius: 12, x: 0, y: 6)
        .padding(.horizontal, Spacing.large)
    }

    // MARK: Photo carousel

    @ViewBuilder
    private var photoCarousel: some View {
        Group {
            if !photoURLs.isEmpty {
                TabView(selection: $currentPhotoIndex) {
                    ForEach(photoURLs.indices, id: \.self) { index in
                        AsyncImage(url: URL(string: photoURLs[index])) { phase in
                            switch phase {
                            case .success(let image):
                                image.resizable().scaledToFill()
                            case .empty:
                                ProgressView().tint(Color.secondary)
                            case .failure:
                                emojiFallback
                            @unknown default:
                                emojiFallback
                            }
                        }
                        .clipped()
                        .tag(index)
                    }
                }
                .tabViewStyle(.page(indexDisplayMode: .never))
                .overlay(alignment: .bottom) {
                    if photoURLs.count > 1 {
                        CapsulePageIndicator(count: photoURLs.count, current: currentPhotoIndex)
                            .padding(.bottom, Spacing.small)
                    }
                }
                .onChange(of: photoURLs) { currentPhotoIndex = 0 }
            } else if isLoadingPhotos {
                photoSkeleton
            } else {
                emojiFallback
            }
        }
        .frame(height: 240)
        .frame(maxWidth: .infinity)
        .background(AppColor.backgroundBrandSubtle)
        .clipped()
    }

    /// Apple-grade loading state: a shimmer sweeping across a neutral fill,
    /// matching the hero's shape rather than a centred spinner.
    private var photoSkeleton: some View {
        Rectangle()
            .fill(AppColor.fillSecondary)
            .overlay {
                GeometryReader { proxy in
                    let width = proxy.size.width
                    LinearGradient(
                        colors: [.clear, AppColor.background.opacity(0.65), .clear],
                        startPoint: .leading,
                        endPoint: .trailing
                    )
                    .frame(width: width * 0.5)
                    .offset(x: shimmerOffset ? width : -width * 0.5)
                    .animation(
                        .linear(duration: 1.2).repeatForever(autoreverses: false),
                        value: shimmerOffset
                    )
                }
            }
            .onAppear { shimmerOffset = true }
    }

    /// Category emoji on a brand-tinted block — the graceful "no photos" state.
    private var emojiFallback: some View {
        Text(PlaceCategoryEmoji.emoji(for: place.category))
            .font(.system(size: 64))
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(AppColor.backgroundBrandSubtle)
    }

    // MARK: Header

    /// The Bump signature two-tone name: the venue name in heavy display black,
    /// the locality in regular italic muted — one continuous run so it wraps as
    /// a single title.
    private var header: some View {
        VStack(alignment: .leading, spacing: Spacing.xSmall) {
            Text(place.name)
                .font(TextStyle.displaySmall)
                .foregroundStyle(AppColor.label)
            + Text(localityText.map { "  \($0)" } ?? "")
                .font(.system(.title3, weight: .regular).italic())
                .foregroundStyle(AppColor.labelSecondary)
        }
        .padding(.horizontal, Spacing.large)
        .fixedSize(horizontal: false, vertical: true)
    }

    /// "Kadıköy, Istanbul" — district then city, de-duplicated and trimmed.
    private var localityText: String? {
        let parts = [place.district, place.city]
            .compactMap { $0?.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        var seen = Set<String>()
        let unique = parts.filter { seen.insert($0).inserted }
        return unique.isEmpty ? nil : unique.joined(separator: ", ")
    }

    // MARK: Metadata row

    /// Apple-Maps-style stat strip: each datum is a column with a quiet caption
    /// label on top and the value below. Horizontally scrollable so a long set
    /// (hours + category + rating + price + distance) never truncates.
    private var metadataRow: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(alignment: .top, spacing: Spacing.xLarge) {
                if let hours = openClosedState {
                    metadataColumn(label: "Hours") {
                        Text(hours.text).foregroundStyle(hours.color)
                    }
                }

                metadataColumn(label: "Category") {
                    Text("\(PlaceCategoryEmoji.emoji(for: place.category)) \(prettyCategory)")
                        .foregroundStyle(AppColor.label)
                }

                if let rating = PlaceFormatting.rating(place.rating) {
                    metadataColumn(label: ratingLabel) {
                        Text("★ ").foregroundStyle(Color(.systemYellow))
                        + Text(rating).foregroundStyle(AppColor.label)
                    }
                }

                if let level = place.priceLevel, (1...4).contains(level) {
                    metadataColumn(label: "Cost") {
                        (1...4).reduce(Text("")) { acc, i in
                            acc + Text("$")
                                .foregroundStyle(i <= level ? AppColor.label : AppColor.labelTertiary)
                        }
                    }
                }

                if let distance = PlaceFormatting.distance(distanceM) {
                    metadataColumn(label: "Distance") {
                        Text(distance).foregroundStyle(AppColor.label)
                    }
                }
            }
            .padding(.horizontal, Spacing.large)
        }
    }

    /// One stat column: uppercase-quiet caption over a bold value.
    private func metadataColumn<Content: View>(
        label: String,
        @ViewBuilder _ value: () -> Content
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.xSmall) {
            Text(label)
                .font(TextStyle.captionLarge)
                .foregroundStyle(AppColor.labelSecondary)
            value()
                .font(TextStyle.titleMedium)
        }
        .fixedSize()
    }

    /// "Rating" with the review count folded into the caption, à la Apple's
    /// "Yelp (1,2K)". Falls back to a bare "Rating" when no count is known.
    private var ratingLabel: String {
        if let count = PlaceFormatting.compactCount(place.ratingCount) {
            return "Rating (\(count))"
        }
        return "Rating"
    }

    /// Open/Closed value for the Hours column — `nil` when hours are unknown.
    /// Closed reads red (Apple's treatment); Open stays neutral to honour the
    /// brand rule that green is a signal colour, never text.
    private var openClosedState: (text: String, color: Color)? {
        guard let isOpen = OpeningHours.isOpen(place.openingHours) else { return nil }
        return isOpen
            ? ("Open", AppColor.label)
            : ("Closed", Color(.systemRed))
    }

    // MARK: Type chips

    /// Secondary Google type tags as small pills below the stat strip.
    @ViewBuilder
    private var typeChipsRow: some View {
        if !typeChips.isEmpty {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.small) {
                    ForEach(typeChips, id: \.self) { type in
                        Text(type)
                            .font(TextStyle.captionLarge)
                            .foregroundStyle(AppColor.labelSecondary)
                            .padding(.horizontal, Spacing.small)
                            .padding(.vertical, Spacing.xSmall)
                            .background(AppColor.fillSecondary, in: RoundedRectangle(cornerRadius: Radius.small))
                    }
                }
                .padding(.horizontal, Spacing.large)
            }
        }
    }

    private var prettyCategory: String {
        guard let raw = place.category?.trimmingCharacters(in: .whitespacesAndNewlines),
              !raw.isEmpty else { return "Place" }
        return raw.replacingOccurrences(of: "_", with: " ").capitalized
    }

    /// Up to three secondary type chips — humanised, de-duped against the
    /// primary category and Google's generic catch-all types.
    private var typeChips: [String] {
        guard let types = place.types else { return [] }
        let noise: Set<String> = ["point_of_interest", "establishment", "food", "store"]
        let categoryKey = place.category?.lowercased()
        var seen = Set<String>()
        return types
            .filter { !noise.contains($0.lowercased()) && $0.lowercased() != categoryKey }
            .filter { seen.insert($0.lowercased()).inserted }
            .prefix(3)
            .map { $0.replacingOccurrences(of: "_", with: " ").capitalized }
    }

    // MARK: Business status

    /// Surfaces a non-operational status (temporarily / permanently closed) as
    /// an inline warning. Hidden for operational venues and unknown status.
    @ViewBuilder
    private var businessStatusNotice: some View {
        if let label = businessStatusLabel {
            Label(label, systemImage: "exclamationmark.triangle.fill")
                .font(TextStyle.titleSmall)
                .foregroundStyle(Color(.systemOrange))
                .padding(.horizontal, Spacing.large)
        }
    }

    private var businessStatusLabel: String? {
        switch place.businessStatus?.lowercased() {
        case "closed_temporarily": "Temporarily closed"
        case "closed_permanently": "Permanently closed"
        default: nil
        }
    }

    // MARK: Hours

    @ViewBuilder
    private var hoursSection: some View {
        if !weeklySchedule.isEmpty {
            sectionCard {
                DisclosureGroup(isExpanded: $hoursExpanded) {
                    VStack(alignment: .leading, spacing: Spacing.small) {
                        ForEach(weeklySchedule) { day in
                            HStack(alignment: .firstTextBaseline) {
                                Text(OpeningHours.weekdaySymbol(day.weekday))
                                    .foregroundStyle(AppColor.label)
                                Spacer(minLength: Spacing.large)
                                Text(day.isClosed ? "Closed" : day.ranges.joined(separator: ", "))
                                    .foregroundStyle(day.isClosed ? AppColor.labelTertiary : AppColor.labelSecondary)
                            }
                            .font(TextStyle.bodyMedium)
                            .fontWeight(OpeningHours.isToday(day.weekday) ? .semibold : .regular)
                        }
                    }
                    .padding(.top, Spacing.small)
                } label: {
                    HStack(spacing: Spacing.small) {
                        Image(systemName: "clock")
                            .foregroundStyle(AppColor.labelSecondary)
                        Text(todayHoursLabel)
                            .font(TextStyle.titleSmall)
                            .foregroundStyle(AppColor.label)
                    }
                }
                .tint(AppColor.labelBrand)
            }
        }
    }

    private var weeklySchedule: [OpeningHours.DaySchedule] {
        OpeningHours.weeklySchedule(place.openingHours)
    }

    private var todayHoursLabel: String {
        if let today = OpeningHours.todayHours(place.openingHours) {
            return "Today  \(today)"
        }
        return "Closed today"
    }

    // MARK: Contact

    /// Call / Website / Instagram pills — each shown only when its datum exists.
    @ViewBuilder
    private var contactRow: some View {
        if hasAnyContact {
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: Spacing.small) {
                    if let phone = place.phoneNumber, let url = telURL(phone) {
                        contactPill("Call", systemImage: "phone.fill") { openURL(url) }
                    }
                    if let website = place.websiteUrl, let url = URL(string: website) {
                        contactPill("Website", systemImage: "globe") { openURL(url) }
                    }
                    if let username = place.instagramUsername,
                       let url = URL(string: "https://instagram.com/\(username)") {
                        contactPill("Instagram", systemImage: "camera.fill") { openURL(url) }
                    }
                }
                .padding(.horizontal, Spacing.large)
            }
        }
    }

    private var hasAnyContact: Bool {
        place.phoneNumber != nil || place.websiteUrl != nil || place.instagramUsername != nil
    }

    private func contactPill(_ title: String, systemImage: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Label(title, systemImage: systemImage)
                .font(TextStyle.titleSmall)
                .padding(.horizontal, Spacing.medium)
                .padding(.vertical, Spacing.small)
        }
        .buttonStyle(.glass)
        .buttonBorderShape(.capsule)
        .tint(AppColor.fillBrand)
    }

    private func telURL(_ raw: String) -> URL? {
        let digits = raw.filter { $0.isNumber || $0 == "+" }
        return digits.isEmpty ? nil : URL(string: "tel:\(digits)")
    }

    // MARK: Recommendations

    @ViewBuilder
    private var recommendationsSection: some View {
        if !place.recommendations.isEmpty {
            sectionCard {
                Text("Worth trying")
                    .font(TextStyle.titleMedium)
                    .foregroundStyle(AppColor.labelSecondary)

                ForEach(Array(place.recommendations.enumerated()), id: \.offset) { _, rec in
                    HStack(alignment: .firstTextBaseline, spacing: Spacing.small) {
                        Text(recommendationEmoji(rec.kind))
                        Text(rec.summary)
                            .font(TextStyle.bodyLarge)
                            .foregroundStyle(AppColor.label)
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, Spacing.xSmall)
                }
            }
        }
    }

    private func recommendationEmoji(_ kind: RecommendationKind) -> String {
        switch kind {
        case .dish: "🍽️"
        case .drink: "🥤"
        case .cocktail: "🍸"
        case .dessert: "🍰"
        case .activity: "✨"
        case .ordering: "📝"
        case .timing: "🕒"
        case .general: "💡"
        }
    }

    // MARK: Notes

    private var notesSection: some View {
        sectionCard {
            HStack {
                Text("Your notes")
                    .font(TextStyle.titleMedium)
                    .foregroundStyle(AppColor.labelSecondary)
                Spacer()
                if isSavingNotes {
                    ProgressView()
                } else if notesDraft != savedNotes {
                    Button("Save") { saveNotes() }
                        .font(TextStyle.titleSmall)
                        .tint(AppColor.labelBrand)
                }
            }

            TextField(
                "Add a note — what to order, who you came with…",
                text: $notesDraft,
                axis: .vertical
            )
            .font(TextStyle.bodyLarge)
            .foregroundStyle(AppColor.label)
            .lineLimit(3...)
            .padding(Spacing.medium)
            .background(AppColor.fillSecondary, in: RoundedRectangle(cornerRadius: Radius.medium))
        }
    }

    private func saveNotes() {
        let trimmed = notesDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        isSavingNotes = true
        Task {
            defer { isSavingNotes = false }
            do {
                let updated = try await repository.update(id: place.id, notes: trimmed.isEmpty ? nil : trimmed)
                savedNotes = updated.notes ?? ""
                notesDraft = updated.notes ?? ""
            } catch {
                // Quietly revert to the last persisted value on failure.
                notesDraft = savedNotes
            }
        }
    }

    // MARK: Info

    /// Address + when-saved — the quiet metadata that grounds the card. Hidden
    /// entirely when neither datum is present.
    @ViewBuilder
    private var infoSection: some View {
        if fullAddress != nil || savedAtText != nil {
            sectionCard {
                if let address = fullAddress {
                    infoRow(systemImage: "mappin", text: address)
                }
                if let saved = savedAtText {
                    infoRow(systemImage: "bookmark", text: saved)
                }
            }
        }
    }

    private func infoRow(systemImage: String, text: String) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.small) {
            Image(systemName: systemImage)
                .foregroundStyle(AppColor.labelSecondary)
                .frame(width: 20, alignment: .center)
            Text(text)
                .font(TextStyle.bodyMedium)
                .foregroundStyle(AppColor.labelSecondary)
            Spacer(minLength: 0)
        }
        .padding(.vertical, Spacing.xSmall)
    }

    private var fullAddress: String? {
        let candidate = place.address ?? place.shortFormattedAddress
        guard let trimmed = candidate?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmed.isEmpty else { return nil }
        return trimmed
    }

    private var savedAtText: String? {
        PlaceFormatting.relativeSavedAt(place.savedAt)
    }

    // MARK: Actions

    private var actionButtons: some View {
        HStack(spacing: Spacing.medium) {
            Button(action: openDirections) {
                Label("Directions", systemImage: "arrow.triangle.turn.up.right.diamond.fill")
                    .font(TextStyle.titleLarge)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.xSmall)
            }
            .buttonStyle(.glassProminent)
            .buttonBorderShape(.capsule)
            .tint(AppColor.fillBrand)

            // "Add to list" depends on the Library/Lists work (P1) — surfaced
            // but disabled so we don't fake an action that isn't wired yet.
            Button {
            } label: {
                Label("Add to list", systemImage: "plus")
                    .font(TextStyle.titleLarge)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, Spacing.xSmall)
            }
            .buttonStyle(.glass)
            .buttonBorderShape(.capsule)
            .tint(AppColor.fillBrand)
            .disabled(true)
        }
        .padding(.horizontal, Spacing.large)
        .padding(.top, Spacing.small)
    }

    private func openDirections() {
        if let uri = place.googleMapsUri, let url = URL(string: uri) {
            openURL(url)
            return
        }
        guard let coordinate = place.location else { return }
        let query = place.name.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
        let fallback = "http://maps.apple.com/?ll=\(coordinate.latitude),\(coordinate.longitude)&q=\(query)"
        if let url = URL(string: fallback) {
            openURL(url)
        }
    }

    // MARK: Loading

    private func loadPhotos() async {
        isLoadingPhotos = true
        defer { isLoadingPhotos = false }
        do {
            photoURLs = try await repository.photos(placeId: place.id, limit: 10, maxWidth: 800)
        } catch {
            photoURLs = []
        }
    }
}

// MARK: - CapsulePageIndicator

/// Scrolling dot indicator inside a capsule background — up to `maxVisible`
/// dots are shown at once. The active dot is full-size white; dots further
/// from the active index shrink and fade, implying the window of pages.
/// Animates smoothly on every index change.
private struct CapsulePageIndicator: View {

    let count: Int
    let current: Int

    private static let maxVisible = 7
    private static let spacing: CGFloat = 5

    var body: some View {
        HStack(spacing: Self.spacing) {
            ForEach(visibleRange, id: \.self) { index in
                Circle()
                    .fill(.white.opacity(dotOpacity(index)))
                    .frame(width: dotSize(index), height: dotSize(index))
            }
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 7)
        .background(.ultraThinMaterial, in: Capsule())
        .animation(.spring(response: 0.3, dampingFraction: 0.75), value: current)
    }

    // MARK: Window

    private var windowStart: Int {
        guard count > Self.maxVisible else { return 0 }
        let half = Self.maxVisible / 2
        return max(0, min(current - half, count - Self.maxVisible))
    }

    private var visibleRange: Range<Int> {
        windowStart ..< min(windowStart + Self.maxVisible, count)
    }

    // MARK: Per-dot metrics

    private func distance(_ index: Int) -> Int { abs(index - current) }

    private func dotSize(_ index: Int) -> CGFloat {
        switch distance(index) {
        case 0: return 7
        case 1: return 6
        case 2: return 4.5
        case 3: return 3
        default: return 2
        }
    }

    private func dotOpacity(_ index: Int) -> Double {
        switch distance(index) {
        case 0: return 1.0
        case 1: return 0.75
        case 2: return 0.45
        case 3: return 0.20
        default: return 0.10
        }
    }
}
