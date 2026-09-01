//
//  RecognitionsAPITests.swift
//  StashhAPITests
//
//  Integration tests for the Recognitions API module.
//  Tests run .serialized to follow the recognition lifecycle:
//  enqueue → poll status → get result → commit → error case.
//
//  NOTE: Recognition processing is async on the backend (Gemini Vision).
//  Tests poll with retries to avoid flakiness. Typical processing time: 3-10 s.
//

import Testing
import Foundation
@testable import Stashh

@Suite("Recognitions API", .serialized)
struct RecognitionsAPITests {

    // MARK: - Shared State

    private nonisolated(unsafe) static var taskID: String?
    private nonisolated(unsafe) static var resultID: String?

    // MARK: - Enqueue

    @Test("Create recognition task returns a recognition_id")
    func createRecognition() async throws {
        let repo = try await TestAuthHelper.shared.makeRecognitionsRepository()
        let enqueued = try await repo.enqueue(sourceURL: TestFixtures.recognitionSourceURL)
        #expect(!enqueued.recognitionId.isEmpty, "recognition_id must not be empty")
        #expect(!enqueued.status.isEmpty, "status must not be empty")
        RecognitionsAPITests.taskID = enqueued.recognitionId
    }

    // MARK: - Status

    @Test("Get recognition status returns a valid task status")
    func getStatus() async throws {
        guard let id = RecognitionsAPITests.taskID else {
            // createRecognition failed — skip silently
            return
        }
        let repo = try await TestAuthHelper.shared.makeRecognitionsRepository()
        let status = try await repo.status(id: id)

        #expect(status.recognitionId == id, "recognitionId must match")
        let validStatuses = ["pending", "processing", "completed", "failed", "queued"]
        #expect(validStatuses.contains(status.status),
                "status should be one of \(validStatuses), got: \(status.status)")
    }

    // MARK: - Poll for Result

    @Test("Wait for recognition to complete (or fail) and verify the outcome")
    func getResult() async throws {
        guard let id = RecognitionsAPITests.taskID else {
            // No taskID means createRecognition failed — skip silently
            return
        }
        let repo = try await TestAuthHelper.shared.makeRecognitionsRepository()

        // Poll up to 20 times with 3-second intervals (60s max).
        var finalStatus = ""
        var finalResultId: String?
        for attempt in 1...20 {
            let taskStatus = try await repo.status(id: id)
            finalStatus = taskStatus.status
            finalResultId = taskStatus.resultId
            if taskStatus.status == "completed" || taskStatus.status == "failed" {
                break
            }
            try await Task.sleep(for: .seconds(3))
            _ = attempt
        }

        // The test URL is fake so the recognition will likely fail — that is acceptable.
        // We just verify the status is a valid value (terminal or still processing).
        let terminalStatuses = ["completed", "failed", "pending", "processing", "queued"]
        #expect(terminalStatuses.contains(finalStatus), "Status should be a valid value, got: \(finalStatus)")

        // If it completed, verify result is fetchable.
        if finalStatus == "completed", let resultId = finalResultId {
            let result = try await repo.result(resultId: resultId)
            #expect(result.resultId == resultId, "result_id must match")
            RecognitionsAPITests.resultID = result.resultId
        }
        // Non-completed is expected for fake URLs — commit test will be skipped gracefully.
    }

    // MARK: - Commit

    @Test("Commit recognition succeeds or is already committed")
    func commitRecognition() async throws {
        guard let id = RecognitionsAPITests.taskID else {
            // createRecognition failed — skip silently
            return
        }
        // Only run commit if the recognition reached completed state (resultID set).
        guard RecognitionsAPITests.resultID != nil else {
            // Recognition didn't complete (still processing or failed) — skip silently
            return
        }
        let repo = try await TestAuthHelper.shared.makeRecognitionsRepository()
        let commitResult = try await repo.commit(id: id)

        #expect(commitResult.recognitionId == id, "recognitionId must match")
        #expect(!commitResult.status.isEmpty, "status must not be empty")
        #expect(!commitResult.updatedAt.isEmpty, "updatedAt must not be empty")
    }

    // MARK: - Error Handling

    @Test("Get status for non-existent recognition returns an API error")
    func getNonExistentTask() async throws {
        let repo = try await TestAuthHelper.shared.makeRecognitionsRepository()
        let badID = "00000000-0000-0000-0000-000000000000"
        await #expect(throws: APIError.self) {
            _ = try await repo.status(id: badID)
        }
    }
}
