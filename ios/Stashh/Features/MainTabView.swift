//
//  MainTabView.swift
//  Stashh
//
//  Created by Emirhan Erdogan on 17/04/2026.
//

import SwiftUI

// MARK: - AppTab

enum AppTab: Hashable {
    case explore
    case library
    case profile
}

// MARK: - MainTabView

struct MainTabView: View {

    @State private var selectedTab: AppTab = .explore

    var body: some View {
        TabView(selection: $selectedTab) {
            Tab("Explore", systemImage: "safari.fill", value: AppTab.explore) {
                ExploreView()
            }
            Tab("Library", systemImage: "bookmark.fill", value: AppTab.library) {
                LibraryView()
            }
            Tab("Profile", systemImage: "person.fill", value: AppTab.profile) {
                ProfileView()
            }
        }
        .tint(AppColor.fillBrand)
    }
}

// MARK: - Preview

#Preview {
    MainTabView()
}
