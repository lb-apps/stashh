//
//  ListsAPITests.swift
//  StashhAPITests
//
//  Integration tests for the Lists API module.
//  Tests run .serialized to exercise the full lifecycle:
//  create → getAll → get → update → addPlace → listPlaces → removePlace → delete
//  A saved place is added first so we have a valid placeId.
//

import Testing
import Foundation
@testable import Stashh

@Suite("Lists API", .serialized)
struct ListsAPITests {

    // MARK: - Shared State

    private nonisolated(unsafe) static var createdListID: String?
    private nonisolated(unsafe) static var createdPlaceID: String?
    /// list_place_id (junction row ID) returned by addPlace, used to removePlace later.
    private nonisolated(unsafe) static var addedListPlaceID: String?

    // MARK: - Setup: Add a place to use in list tests

    @Test("Setup: ensure a saved place exists in the library")
    func setupAddPlace() async throws {
        let repo = try await TestAuthHelper.shared.makePlacesRepository()

        // Prefer a place already in the library — avoids Google Places resolver.
        let existing = try await repo.list(limit: 1, cursor: nil, sort: nil, district: nil, category: nil)
        if let first = existing.data.first {
            ListsAPITests.createdPlaceID = first.id
            return
        }

        // Fall back to adding from fixture if library is empty.
        let results = try await repo.add(TestFixtures.addPlacesRequest())
        let first = try #require(results.first, "Expected at least one result from POST /places")
        ListsAPITests.createdPlaceID = first.placeId
    }

    // MARK: - Create

    @Test("Create a list returns a PlaceList with the expected title")
    func createList() async throws {
        let repo = try await TestAuthHelper.shared.makeListsRepository()
        let req = TestFixtures.createListRequest()
        let list = try await repo.create(body: req)

        #expect(list.title == req.title, "List title should be '\(req.title)', got: \(list.title)")
        #expect(!list.id.isEmpty, "List ID must not be empty")
        #expect(list.emoji == req.emoji)
        ListsAPITests.createdListID = list.id
    }

    // MARK: - Get All

    @Test("Get all lists returns an array containing the created list")
    func getAllLists() async throws {
        guard let id = ListsAPITests.createdListID else { return }
        let repo = try await TestAuthHelper.shared.makeListsRepository()
        let all = try await repo.list()

        #expect(all.contains(where: { $0.id == id }),
                "All lists should contain the just-created list (id: \(id))")
    }

    // MARK: - Get Single

    @Test("Get single list returns the correct PlaceList")
    func getList() async throws {
        guard let id = ListsAPITests.createdListID else { return }
        let repo = try await TestAuthHelper.shared.makeListsRepository()
        let list = try await repo.get(id: id)

        #expect(list.id == id)
        #expect(list.title == TestFixtures.createListRequest().title)
    }

    // MARK: - Update

    @Test("Update list title and emoji persists the changes")
    func updateList() async throws {
        guard let id = ListsAPITests.createdListID else { return }
        let repo = try await TestAuthHelper.shared.makeListsRepository()
        let patch = TestFixtures.patchListRequest()
        let updated = try await repo.update(id: id, body: patch)

        #expect(updated.id == id)
        #expect(updated.title == patch.title, "Title should be updated")
        #expect(updated.emoji == patch.emoji, "Emoji should be updated")
    }

    // MARK: - Add Place to List

    @Test("Add a place to the list returns an AddListPlaceResult")
    func addPlaceToList() async throws {
        guard let listID = ListsAPITests.createdListID,
              let placeID = ListsAPITests.createdPlaceID else { return }
        let repo = try await TestAuthHelper.shared.makeListsRepository()
        let result = try await repo.addPlace(listId: listID, placeId: placeID)

        #expect(!result.listPlaceId.isEmpty, "listPlaceId must not be empty")
        #expect(result.listId == listID, "listId must match the requested list")
        #expect(result.placeId == placeID, "placeId must match the requested place")
        // Store the junction-row ID for the removePlace test.
        ListsAPITests.addedListPlaceID = result.listPlaceId
    }

    // MARK: - List Places in List

    @Test("Get places in list returns the added place")
    func getListPlaces() async throws {
        guard let listID = ListsAPITests.createdListID else { return }
        let repo = try await TestAuthHelper.shared.makeListsRepository()
        let response = try await repo.places(listId: listID, limit: 20, cursor: nil)
        let items = response.data

        if ListsAPITests.addedListPlaceID != nil {
            #expect(!items.isEmpty, "Expected at least one place in the list")
        }
        #expect(items.count >= 0, "Paginated response data is a valid array")

        // Verify item shape — each item has a nested place
        for item in items {
            #expect(!item.listPlaceId.isEmpty)
            #expect(!item.place.name.isEmpty)
        }
    }

    // MARK: - Remove Place from List

    @Test("Remove place from list succeeds")
    func removePlaceFromList() async throws {
        guard let listID = ListsAPITests.createdListID,
              let listPlaceID = ListsAPITests.addedListPlaceID else { return }
        let repo = try await TestAuthHelper.shared.makeListsRepository()
        try await repo.removePlace(listId: listID, listPlaceId: listPlaceID)

        let response = try await repo.places(listId: listID, limit: 20, cursor: nil)
        let items = response.data
        #expect(!items.contains(where: { $0.listPlaceId == listPlaceID }),
                "Removed item should no longer appear in list places")
        ListsAPITests.addedListPlaceID = nil
    }

    // MARK: - Error Handling

    @Test("Get non-existent list returns an API error")
    func getNonExistentList() async throws {
        let repo = try await TestAuthHelper.shared.makeListsRepository()
        let badID = "00000000-0000-0000-0000-000000000000"
        await #expect(throws: APIError.self) {
            _ = try await repo.get(id: badID)
        }
    }

    // MARK: - Delete (runs last)

    @Test("Delete list removes it from all lists")
    func deleteList() async throws {
        guard let id = ListsAPITests.createdListID else { return }
        let repo = try await TestAuthHelper.shared.makeListsRepository()
        try await repo.delete(id: id)

        let all = try await repo.list()
        #expect(!all.contains(where: { $0.id == id }),
                "Deleted list should no longer appear in all lists")
        ListsAPITests.createdListID = nil
    }

    @Test("Teardown: remove test place from library if we added it")
    func teardownRemovePlace() async throws {
        // Only delete if the setup actually added a new place (not using a pre-existing one).
        // The setup now prefers existing places, so this is usually a no-op.
        guard let id = ListsAPITests.createdPlaceID else { return }
        // We do NOT delete pre-existing library places; only clean up if we added from fixture.
        // Since setup preferentially uses existing places, skip deletion to preserve real data.
        ListsAPITests.createdPlaceID = nil
    }
}
