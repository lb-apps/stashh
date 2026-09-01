//
//  URL+API.swift
//  Stashh
//

import Foundation

extension URL {
    /// Returns a new URL with additional query items appended.
    func appendingQueryItems(_ items: [URLQueryItem]) -> URL {
        guard !items.isEmpty,
              var components = URLComponents(url: self, resolvingAgainstBaseURL: false) else {
            return self
        }
        var existing = components.queryItems ?? []
        existing.append(contentsOf: items)
        components.queryItems = existing
        return components.url ?? self
    }
}
