//
//  LocationManager.swift
//  Stashh
//

import CoreLocation
import Foundation
import Observation

// MARK: - LocationManager

/// Observable wrapper around `CLLocationManager` that exposes the current
/// authorization state, the latest coordinate, and a single entry point to
/// kick off permission + location acquisition.
@MainActor
@Observable
final class LocationManager: NSObject {

    // MARK: AuthorizationState

    enum AuthorizationState: Sendable {
        case notDetermined
        case denied
        case restricted
        case authorized
    }

    // MARK: LocationCoordinate

    /// Equatable/Sendable mirror of `CLLocationCoordinate2D` so views can
    /// observe changes via `onChange`.
    struct LocationCoordinate: Equatable, Sendable {
        let latitude: Double
        let longitude: Double

        var clCoordinate: CLLocationCoordinate2D {
            CLLocationCoordinate2D(latitude: latitude, longitude: longitude)
        }
    }

    // MARK: Published State

    private(set) var coordinate: LocationCoordinate?
    private(set) var authorizationState: AuthorizationState = .notDetermined
    private(set) var lastError: (any Error)?

    // MARK: Private

    private let manager: CLLocationManager

    // MARK: Init

    override init() {
        self.manager = CLLocationManager()
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyHundredMeters
        syncAuthorizationState()
    }

    // MARK: Intents

    /// Request When-In-Use authorization (if needed) and a single location fix.
    /// Safe to call multiple times — it is a no-op once permission has been denied.
    func requestCurrentLocation() {
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            manager.requestLocation()
        case .denied, .restricted:
            syncAuthorizationState()
        @unknown default:
            break
        }
    }

    // MARK: Helpers

    private func syncAuthorizationState() {
        switch manager.authorizationStatus {
        case .notDetermined:
            authorizationState = .notDetermined
        case .denied:
            authorizationState = .denied
        case .restricted:
            authorizationState = .restricted
        case .authorizedAlways, .authorizedWhenInUse:
            authorizationState = .authorized
        @unknown default:
            authorizationState = .notDetermined
        }
    }
}

// MARK: - CLLocationManagerDelegate

extension LocationManager: @preconcurrency CLLocationManagerDelegate {

    func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        syncAuthorizationState()
        if authorizationState == .authorized {
            manager.requestLocation()
        }
    }

    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let raw = locations.last?.coordinate else { return }
        self.coordinate = LocationCoordinate(latitude: raw.latitude, longitude: raw.longitude)
    }

    func locationManager(_ manager: CLLocationManager, didFailWithError error: any Error) {
        lastError = error
    }
}
