//
//  ExploreViewModel.swift
//  Stashh
//

import CoreLocation
import Foundation
import MapKit
import Observation

// MARK: - ExploreViewModel

/// Drives the Explore map: keeps a deduplicated set of nearby places, debounces
/// fetches as the user pans, and derives the search radius from the visible
/// region.
@MainActor
@Observable
final class ExploreViewModel {

    // MARK: Constants

    /// The backend caps `radius_m` at 50_000. Keep a small safety margin so we
    /// never accidentally submit an over-limit request when the user zooms out.
    static let maxRadiusM: Int = 50_000
    static let minRadiusM: Int = 200
    static let defaultPageSize: Int = 50
    /// Delay (in nanoseconds) between the last map change and the fetch call.
    /// 400 ms feels responsive without spamming the API during continuous pans.
    private static let debounceNanoseconds: UInt64 = 400_000_000

    // MARK: Published State

    /// All places fetched so far, keyed by ID for free deduplication.
    private(set) var placesByID: [String: Place] = [:]
    private(set) var isLoading: Bool = false
    private(set) var lastError: (any Error)?

    /// The currently selected pin's place ID, or `nil` when nothing is
    /// selected. Stored by ID rather than the whole `Place` so a background
    /// refresh that re-merges the place can't strand a stale selection.
    private(set) var selectedPlaceID: String?

    var places: [Place] {
        Array(placesByID.values)
    }

    /// The selected place resolved from the live `placesByID`, or `nil`.
    /// Backs the detail sheet via `.sheet(item:)`.
    var selectedPlace: Place? {
        guard let selectedPlaceID else { return nil }
        return placesByID[selectedPlaceID]
    }

    // MARK: Dependencies

    private let repository: any PlacesRepositoryProtocol

    // MARK: Private

    private var debounceTask: Task<Void, Never>?
    private var activeFetch: Task<Void, Never>?

    // MARK: Init

    init(repository: any PlacesRepositoryProtocol) {
        self.repository = repository
    }

    // MARK: Intents

    /// Immediately fetch nearby places for the given region, cancelling any
    /// pending debounced request. Use for the initial load.
    func fetchImmediately(for region: MKCoordinateRegion) {
        debounceTask?.cancel()
        activeFetch?.cancel()
        activeFetch = Task { [weak self] in
            await self?.performFetch(for: region)
        }
    }

    /// Select a pin. Idempotent — selecting the already-selected place is a
    /// no-op so a repeat tap doesn't thrash the camera animation.
    func select(_ place: Place) {
        guard selectedPlaceID != place.id else { return }
        selectedPlaceID = place.id
    }

    /// Clear the current selection (basemap tap or sheet dismissal).
    func clearSelection() {
        selectedPlaceID = nil
    }

    /// Whether the given place is the selected one — drives the pin's theming.
    func isSelected(_ place: Place) -> Bool {
        selectedPlaceID == place.id
    }

    /// Debounced fetch — call while the user is actively panning the map.
    func regionDidChange(_ region: MKCoordinateRegion) {
        debounceTask?.cancel()
        debounceTask = Task { [weak self] in
            try? await Task.sleep(nanoseconds: Self.debounceNanoseconds)
            guard let self, !Task.isCancelled else { return }
            self.activeFetch?.cancel()
            self.activeFetch = Task { [weak self] in
                await self?.performFetch(for: region)
            }
        }
    }

    // MARK: Fetch

    private func performFetch(for region: MKCoordinateRegion) async {
        let center = region.center
        let radiusM = Self.radius(for: region)

        isLoading = true
        defer { isLoading = false }

        do {
            let response = try await repository.fetchNearbyPlaces(
                latitude: center.latitude,
                longitude: center.longitude,
                radiusM: radiusM,
                limit: Self.defaultPageSize,
                cursor: nil,
                category: nil
            )
            guard !Task.isCancelled else { return }
            merge(response.data)
            lastError = nil
        } catch {
            guard !Task.isCancelled else { return }
            lastError = error
        }
    }

    private func merge(_ incoming: [Place]) {
        for place in incoming {
            placesByID[place.id] = place
        }
    }

    // MARK: Radius

    /// Convert the visible region's span into a radius in metres. We take the
    /// larger of the two half-spans so that every pin inside the viewport
    /// would in principle be covered by a single request.
    static func radius(for region: MKCoordinateRegion) -> Int {
        let center = region.center
        let latMeters = halfSpanMeters(
            from: center,
            deltaLatitude: region.span.latitudeDelta / 2,
            deltaLongitude: 0
        )
        let lonMeters = halfSpanMeters(
            from: center,
            deltaLatitude: 0,
            deltaLongitude: region.span.longitudeDelta / 2
        )
        let raw = Int(ceil(max(latMeters, lonMeters)))
        return min(max(raw, minRadiusM), maxRadiusM)
    }

    private static func halfSpanMeters(
        from center: CLLocationCoordinate2D,
        deltaLatitude: Double,
        deltaLongitude: Double
    ) -> Double {
        let a = CLLocation(latitude: center.latitude, longitude: center.longitude)
        let b = CLLocation(
            latitude: center.latitude + deltaLatitude,
            longitude: center.longitude + deltaLongitude
        )
        return a.distance(from: b)
    }
}
