//
//  LibraryView.swift
//  Stashh
//
//  Created by Emirhan Erdogan on 17/04/2026.
//

import SwiftUI

// MARK: - LibraryView

struct LibraryView: View {

    var body: some View {
        NavigationStack {
            Text("Library")
                .font(TextStyle.headlineMedium)
                .foregroundStyle(AppColor.labelSecondary)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(AppColor.background)
        }
    }
}

// MARK: - Preview

#Preview {
    LibraryView()
}
