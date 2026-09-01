//
//  StashhApp.swift
//  Stashh
//
//  Created by Emirhan Erdogan on 26/03/2026.
//

import SwiftUI

@main
struct StashhApp: App {

    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            MainTabView()
                .environment(appState)
        }
    }
}
