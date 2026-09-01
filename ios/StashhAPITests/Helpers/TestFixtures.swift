//
//  TestFixtures.swift
//  StashhAPITests
//
//  Reusable test data factories and constants shared across all test suites.
//  Using a real, stable Google Place ID ensures consistent test results.
//

import Foundation
@testable import Stashh

// MARK: - TestFixtures

enum TestFixtures {

    // MARK: - Known Google Place IDs

    /// Cipriani Istanbul — a place that is already saved in the test account library.
    /// Used as the primary test fixture to avoid hitting the Google Places resolver.
    static let ciprianIstanbulPlaceID = "ChIJCQ6A13i2yhQR1De5X58bfWQ"

    /// Hagia Sophia — a globally recognised landmark in Istanbul.
    /// Kept as a secondary fallback; may fail if the Google Places resolver is unavailable.
    static let hagiaSOphiaPlaceID = "ChIJa1xnZM6byhQRAE5Mc-n8blo"

    /// A secondary Istanbul landmark (Topkapi Palace) used in multi-place tests.
    static let topkapiPalacePlaceID = "ChIJi_C3YQFV0xQRmZDZ6gTNiqQ"

    // MARK: - Places

    /// Returns a valid `AddPlacesRequest` with the given Google Place IDs.
    static func addPlacesRequest(placeIDs: [String] = [ciprianIstanbulPlaceID]) -> AddPlacesRequest {
        .google(placeIds: placeIDs)
    }

    /// Returns an `UpdatePlaceRequest` with a non-empty notes string.
    static func updatePlaceRequest(notes: String = "Test notes — written by StashhAPITests") -> UpdatePlaceRequest {
        UpdatePlaceRequest(notes: notes)
    }

    // MARK: - Lists

    /// Returns a `CreateListRequest` with stable test data.
    static func createListRequest(
        title: String = "API Test List",
        description: String? = "Created by StashhAPITests",
        emoji: String? = "🧪"
    ) -> CreateListRequest {
        CreateListRequest(title: title, description: description, emoji: emoji)
    }

    /// Returns a `PatchListRequest` to rename the test list.
    static func patchListRequest(
        title: String? = "API Test List (Updated)",
        emoji: String? = "✅"
    ) -> PatchListRequest {
        PatchListRequest(title: title, emoji: emoji)
    }

    // MARK: - Recognitions

    /// A real public Instagram Reel URL used to create a test recognition task.
    /// The backend validates the URL format and will process this content via Gemini Vision.
    static let recognitionSourceURL = "https://www.instagram.com/reel/DTQTdKJDEdI/?igsh=MTJkdzNwcXI4dzE5aw=="

    /// Returns a `CreateRecognitionRequest` pointing at the test Instagram URL.
    static func createRecognitionRequest() -> CreateRecognitionRequest {
        CreateRecognitionRequest(sourceUrl: recognitionSourceURL)
    }
}
