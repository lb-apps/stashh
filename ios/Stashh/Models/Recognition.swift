//
//  Recognition.swift
//  Stashh
//
//  Maps to recognition DTOs from the Recognitions API.

import Foundation

// MARK: - RecognitionEnqueued

/// Response from POST /recognitions (202 Accepted).
/// { recognition_id, status, created_at }
struct RecognitionEnqueued: Codable, Sendable {
    let recognitionId: String
    let status: String
    let createdAt: String
}

// MARK: - RecognitionStatus

/// Response from GET /recognitions/{id}.
/// Full task status including result_id once completed.
struct RecognitionStatus: Codable, Sendable {
    let recognitionId: String
    let status: String
    let sourceUrl: String
    let resultId: String?
    let errorMessage: String?
    let retryCount: Int
    let startedAt: String?
    let finishedAt: String?
    let createdAt: String
    let updatedAt: String
}

// MARK: - RecognitionStatusValue

enum RecognitionStatusValue: String, Sendable {
    case pending
    case processing
    case completed
    case failed
}

// MARK: - RecognitionResult

/// Response from GET /recognitions/result?id={result_id}.
/// { result_id, source_url, video_url, caption, source_type, places, created_at, updated_at }
struct RecognitionResult: Codable, Sendable {
    let resultId: String
    let sourceUrl: String
    let videoUrl: String?
    let caption: String?
    let sourceType: String?
    /// Raw JSON array of extracted places — decoded as generic JSON.
    let places: [RecognitionPlace]?
    let createdAt: String
    let updatedAt: String
}

// MARK: - RecognitionPlace

/// A single place extracted by the recognition pipeline.
struct RecognitionPlace: Codable, Sendable, Hashable {
    let name: String?
    let googlePlaceId: String?
    let address: String?
}

// MARK: - RecognitionCommitResult

/// Response from POST /recognitions/{id}/commit.
/// { recognition_id, status, updated_at }
struct RecognitionCommitResult: Codable, Sendable {
    let recognitionId: String
    let status: String
    let updatedAt: String
}
