//
//  Pagination.swift
//  Stashh
//

import Foundation

// MARK: - Pagination

/// Cursor-based pagination state for a paginated list.
///
/// The backend uses opaque base64url cursors; do not try to decode them.
struct Pagination: Sendable {
    let limit: Int
    let nextCursor: String?
    let hasMore: Bool

    static let empty = Pagination(limit: 20, nextCursor: nil, hasMore: false)

    init(limit: Int, nextCursor: String?, hasMore: Bool) {
        self.limit = limit
        self.nextCursor = nextCursor
        self.hasMore = hasMore
    }

    init(from meta: PaginationMeta) {
        self.limit = meta.limit
        self.nextCursor = meta.nextCursor
        self.hasMore = meta.hasMore
    }
}
