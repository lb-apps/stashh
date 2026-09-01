//
//  ExploreView.swift
//  Stashh
//
//  Created by Emirhan Erdogan on 17/04/2026.
//

import CoreLocation
import MapKit
import SwiftUI
import UIKit

// MARK: - ExploreView

struct ExploreView: View {

    // MARK: Environment

    @Environment(AppState.self) private var appState

    // MARK: State

    @State private var locationManager = LocationManager()
    @State private var viewModel: ExploreViewModel?
    @State private var cameraPosition: MapCameraPosition = .region(Self.fallbackRegion)
    @State private var currentRegion: MKCoordinateRegion = Self.fallbackRegion
    /// The flat, top-down region the user was browsing immediately before a
    /// selection. Captured on the nil → selected transition so dismissing the
    /// sheet can glide the map back to exactly that 2D framing.
    @State private var preSelectionRegion: MKCoordinateRegion = Self.fallbackRegion
    @State private var didPerformInitialFetch = false

    // MARK: Constants

    /// Neutral default (Istanbul) shown while we wait for the user's location.
    private static let fallbackRegion = MKCoordinateRegion(
        center: CLLocationCoordinate2D(latitude: 41.0082, longitude: 28.9784),
        latitudinalMeters: 2_000,
        longitudinalMeters: 2_000
    )

    /// Camera pitch applied while a pin is selected — tilts the map into a 3D
    /// view that settles back to flat (0°) when the selection clears.
    private static let selectedPitch: Double = 50

    /// How far above the camera's look-at point the selected pin should sit,
    /// as a fraction of the visible latitude span. Pushes the pin up into the
    /// map area left visible above the medium sheet detent.
    private static let selectionLiftFraction: Double = 0.20

    // MARK: Body

    var body: some View {
        mapContent
            .ignoresSafeArea()
            .overlay { stateOverlay }
            .overlay(alignment: .bottomTrailing) { addPlaceFAB }
            .task { bootstrapIfNeeded() }
            .onChange(of: locationManager.coordinate, initial: false) { _, newValue in
                handleLocationUpdate(newValue)
            }
            .onMapCameraChange(frequency: .onEnd) { context in
                currentRegion = context.region
                viewModel?.regionDidChange(context.region)
            }
            .onChange(of: viewModel?.selectedPlaceID) { oldID, newID in
                handleSelectionChange(from: oldID ?? nil, to: newID ?? nil)
            }
            .sheet(item: selectedPlaceBinding) { place in
                PlaceDetailView(
                    place: place,
                    repository: appState.placesRepository,
                    distanceM: distanceFromUser(to: place)
                )
                .presentationDetents([.medium, .large])
                .presentationBackgroundInteraction(.enabled(upThrough: .medium))
                .presentationDragIndicator(.visible)
            }
    }

    // MARK: Bindings

    /// Bridges the view model's selection to `.sheet(item:)`. Reading resolves
    /// the live `Place`; setting `nil` (sheet dismissal) clears the selection.
    private var selectedPlaceBinding: Binding<Place?> {
        Binding(
            get: { viewModel?.selectedPlace },
            set: { newValue in
                if newValue == nil { viewModel?.clearSelection() }
            }
        )
    }

    // MARK: Subviews

    @ViewBuilder
    private var mapContent: some View {
        Map(position: $cameraPosition) {
            UserAnnotation()

            if let viewModel {
                // Draw the selected pin last so its halo and cobalt fill sit
                // above neighbouring pills — MapKit has no z-index control, so
                // declaration order is the lever.
                ForEach(orderedPlaces(viewModel), id: \.id) { place in
                    if let coordinate = place.location?.clCoordinate {
                        // `Annotation(title:coordinate:)` renders the place's
                        // name in MapKit's native label treatment below the
                        // pill, which is why `ExplorePlacePinView` itself no
                        // longer carries the name.
                        Annotation(place.name, coordinate: coordinate, anchor: .bottom) {
                            ExplorePlacePinView(
                                category: place.category,
                                rating: place.rating,
                                ratingCount: place.ratingCount,
                                priceLevel: place.priceLevel,
                                // Distance is computed from the user's actual
                                // location — not the map's query centre — so
                                // panning the map doesn't change the numbers
                                // on existing pins.
                                distanceM: distanceFromUser(to: place),
                                isSelected: viewModel.isSelected(place)
                            )
                            .onTapGesture { select(place) }
                        }
                    }
                }
            }
        }
        // A tap that lands on the basemap (not a pin) clears the selection.
        .onTapGesture { viewModel?.clearSelection() }
        // Flatter, quieter basemap; hide Apple POIs so only our annotations compete for attention.
        .mapStyle(
            .standard(
                elevation: .flat,
                emphasis: .muted,
                pointsOfInterest: .excludingAll
            )
        )
        .mapControls {
            MapUserLocationButton()
            MapCompass()
        }
    }

    // MARK: State overlay

    /// Empty-result and permission-denied states layered over the map. Returns
    /// an `EmptyView` during the normal "we have pins" path so the map stays
    /// untouched.
    @ViewBuilder
    private var stateOverlay: some View {
        if locationManager.authorizationState == .denied
            || locationManager.authorizationState == .restricted {
            ExploreMessageOverlay(
                // TODO: swap the SF Symbol for the glossy 3D mascot asset.
                systemImage: "location.slash.fill",
                title: "Location is off",
                message: "Turn on location to discover places saved near you.",
                actionTitle: "Enable location",
                action: openSettings
            )
        } else if let viewModel,
                  !viewModel.isLoading,
                  viewModel.places.isEmpty,
                  didPerformInitialFetch {
            ExploreMessageOverlay(
                // TODO: swap the SF Symbol for the glossy 3D mascot asset.
                systemImage: "mappin.slash",
                title: "Nothing saved here yet",
                message: "Pan the map or save a place to see it light up here.",
                actionTitle: nil,
                action: nil
            )
        }
    }

    // MARK: Derived

    /// Places ordered so the selected one is emitted last (drawn on top).
    private func orderedPlaces(_ viewModel: ExploreViewModel) -> [Place] {
        let places = viewModel.places
        guard let selectedID = viewModel.selectedPlaceID,
              places.contains(where: { $0.id == selectedID }) else {
            return places
        }
        return places.filter { $0.id != selectedID }
            + places.filter { $0.id == selectedID }
    }

    /// Distance in metres between the user's current location and `place`.
    ///
    /// Intentionally ignores `place.distanceM` from the API response — that
    /// value is measured from the request's `latitude`/`longitude` (the map's
    /// query centre), which shifts as the user pans. Recomputing from the
    /// device location keeps each pin's distance anchored to where the
    /// *user* is, so panning the map does not mutate already-visible pins.
    private func distanceFromUser(to place: Place) -> Double? {
        guard
            let userCoord = locationManager.coordinate?.clCoordinate,
            let placeCoord = place.location?.clCoordinate
        else { return nil }

        let userLocation = CLLocation(
            latitude: userCoord.latitude,
            longitude: userCoord.longitude
        )
        let placeLocation = CLLocation(
            latitude: placeCoord.latitude,
            longitude: placeCoord.longitude
        )
        return userLocation.distance(from: placeLocation)
    }

    // MARK: Actions

    private func bootstrapIfNeeded() {
        if viewModel == nil {
            viewModel = ExploreViewModel(repository: appState.placesRepository)
        }
        locationManager.requestCurrentLocation()
    }

    /// Record the tap. The camera move is driven by `handleSelectionChange`,
    /// which observes the resulting selection so a tap and a programmatic
    /// selection animate identically.
    private func select(_ place: Place) {
        viewModel?.select(place)
    }

    /// Drive the camera off selection changes: tilt into 3D and lift the pin
    /// into the area left visible above the sheet when something is selected;
    /// glide back to the captured flat 2D framing when it clears.
    private func handleSelectionChange(from oldID: String?, to newID: String?) {
        guard let viewModel else { return }

        if let newID,
           let place = viewModel.selectedPlace,
           place.id == newID,
           let coordinate = place.location?.clCoordinate {
            // Only the nil → selected hop captures the flat framing; a
            // selected → selected hop (tapping a second pin) must not overwrite
            // it with the already-pitched region.
            if oldID == nil {
                preSelectionRegion = currentRegion
            }

            let span = preSelectionRegion.span
            // Place the look-at point south of the pin so the pin renders above
            // centre, in the map slice visible over the medium sheet detent.
            let lookAt = CLLocationCoordinate2D(
                latitude: coordinate.latitude - span.latitudeDelta * Self.selectionLiftFraction,
                longitude: coordinate.longitude
            )
            let camera = MapCamera(
                centerCoordinate: lookAt,
                distance: Self.cameraDistance(for: preSelectionRegion),
                heading: 0,
                pitch: Self.selectedPitch
            )
            withAnimation(Motion.sheet) {
                cameraPosition = .camera(camera)
            }
        } else {
            // Region positioning is inherently top-down, so this also drops the
            // pitch back to flat 2D.
            withAnimation(Motion.sheet) {
                cameraPosition = .region(preSelectionRegion)
            }
        }
    }

    /// Approximate the MapCamera `distance` that reproduces a region's zoom —
    /// the ground distance across its visible latitude span.
    private static func cameraDistance(for region: MKCoordinateRegion) -> Double {
        let center = region.center
        let north = CLLocation(
            latitude: center.latitude + region.span.latitudeDelta / 2,
            longitude: center.longitude
        )
        let south = CLLocation(
            latitude: center.latitude - region.span.latitudeDelta / 2,
            longitude: center.longitude
        )
        return max(north.distance(from: south), 300)
    }

    private func openSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
        UIApplication.shared.open(url)
    }

    private func handleLocationUpdate(_ coordinate: LocationManager.LocationCoordinate?) {
        guard let coordinate, !didPerformInitialFetch else { return }
        didPerformInitialFetch = true

        let region = MKCoordinateRegion(
            center: coordinate.clCoordinate,
            latitudinalMeters: 1_500,
            longitudinalMeters: 1_500
        )
        currentRegion = region
        withAnimation {
            cameraPosition = .region(region)
        }
        viewModel?.fetchImmediately(for: region)
    }
    // MARK: FAB

    private var addPlaceFAB: some View {
        Button {
            // TODO: open add-place sheet
        } label: {
            Image(systemName: "plus")
                .font(.title3.weight(.medium))
        }
        .buttonStyle(.glassProminent)
        .buttonBorderShape(.circle)
        .controlSize(.extraLarge)
        .tint(AppColor.fillBrand)
        .padding(.trailing, Spacing.large)
        .padding(.bottom, Spacing.large)
    }
}

// MARK: - ExploreMessageOverlay

/// Centred empty / permission state shown over the map. Uses a native
/// `ContentUnavailableView` for the icon + copy and a themed pill button for
/// the optional CTA, so it reads as a first-class iOS state rather than a
/// bespoke panel.
private struct ExploreMessageOverlay: View {

    let systemImage: String
    let title: String
    let message: String
    let actionTitle: String?
    let action: (() -> Void)?

    var body: some View {
        VStack(spacing: Spacing.large) {
            ContentUnavailableView {
                Label(title, systemImage: systemImage)
            } description: {
                Text(message)
            }

            if let actionTitle, let action {
                Button(action: action) {
                    Text(actionTitle)
                        .font(TextStyle.titleMedium)
                        .padding(.horizontal, Spacing.small)
                }
                .buttonStyle(.borderedProminent)
                .buttonBorderShape(.capsule)
                .tint(AppColor.fillBrand)
            }
        }
        .padding(Spacing.xLarge)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: Radius.xLarge))
        .padding(Spacing.xLarge)
    }
}

// MARK: - Coordinate Bridge

private extension Coordinate {
    var clCoordinate: CLLocationCoordinate2D {
        CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
    }
}

// MARK: - Preview

#Preview {
    ExploreView()
        .environment(AppState())
}
