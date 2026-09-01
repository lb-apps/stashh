//
//  RecognitionsRepository.swift
//  Stashh
//

import Foundation

// MARK: - RecognitionsRepositoryProtocol

protocol RecognitionsRepositoryProtocol: Sendable {
    func enqueue(sourceURL: String) async throws(APIError) -> RecognitionEnqueued
    func status(id: String) async throws(APIError) -> RecognitionStatus
    func result(resultId: String) async throws(APIError) -> RecognitionResult
    func commit(id: String) async throws(APIError) -> RecognitionCommitResult
}

// MARK: - RecognitionsRepository

struct RecognitionsRepository: RecognitionsRepositoryProtocol, Sendable {
    private let client: APIClient

    init(client: APIClient) {
        self.client = client
    }

    func enqueue(sourceURL: String) async throws(APIError) -> RecognitionEnqueued {
        try await client.request(.createRecognition(sourceURL: sourceURL), as: RecognitionEnqueued.self)
    }

    func status(id: String) async throws(APIError) -> RecognitionStatus {
        try await client.request(.recognitionStatus(id: id), as: RecognitionStatus.self)
    }

    /// Fetch the completed result by result_id (from status.resultId).
    func result(resultId: String) async throws(APIError) -> RecognitionResult {
        try await client.request(.recognitionResult(resultId: resultId), as: RecognitionResult.self)
    }

    func commit(id: String) async throws(APIError) -> RecognitionCommitResult {
        try await client.request(.commitRecognition(id: id), as: RecognitionCommitResult.self)
    }
}
