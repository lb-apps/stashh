//
//  LibraryAPITests.swift
//  StashhAPITests
//
//  Integration tests for the Library API module (GET /library).
//  Response shape: { districts, categories, lists, total_saved_count }
//

import Testing
import Foundation
@testable import Stashh

@Suite("Library API")
struct LibraryAPITests {

    // MARK: - Summary

    @Test("Get library summary decodes correctly")
    func getSummary() async throws {
        let repo = try await TestAuthHelper.shared.makeLibraryRepository()
        let summary = try await repo.summary()

        // totalSavedCount must be non-negative.
        #expect(summary.totalSavedCount >= 0,
                "totalSavedCount must be >= 0, got: \(summary.totalSavedCount)")

        // districts and categories are arrays — valid even if empty.
        for district in summary.districts {
            #expect(!district.district.isEmpty, "District name must not be empty")
            #expect(district.placeCount > 0, "District placeCount must be positive, got: \(district.placeCount)")
        }
        for category in summary.categories {
            #expect(!category.category.isEmpty, "Category name must not be empty")
            #expect(category.placeCount > 0, "Category placeCount must be positive, got: \(category.placeCount)")
        }
        for list in summary.lists {
            #expect(!list.id.isEmpty, "List id must not be empty")
            #expect(!list.title.isEmpty, "List title must not be empty")
            #expect(list.placeCount >= 0, "List placeCount must be >= 0")
        }
    }

    @Test("Library district counts do not exceed totalSavedCount")
    func summaryCountsAreConsistent() async throws {
        let repo = try await TestAuthHelper.shared.makeLibraryRepository()
        let summary = try await repo.summary()

        let districtSum = summary.districts.reduce(0) { $0 + $1.placeCount }
        if !summary.districts.isEmpty {
            #expect(districtSum <= summary.totalSavedCount,
                    "Sum of district place counts (\(districtSum)) should not exceed totalSavedCount (\(summary.totalSavedCount))")
        }
    }
}
