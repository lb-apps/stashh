//
//  LibraryRepository.swift
//  Stashh
//

import Foundation

// MARK: - LibraryRepositoryProtocol

protocol LibraryRepositoryProtocol: Sendable {
    func summary() async throws(APIError) -> Library
}

// MARK: - LibraryRepository

struct LibraryRepository: LibraryRepositoryProtocol, Sendable {
    private let client: APIClient

    init(client: APIClient) {
        self.client = client
    }

    func summary() async throws(APIError) -> Library {
        try await client.request(.library(), as: Library.self)
    }
}
