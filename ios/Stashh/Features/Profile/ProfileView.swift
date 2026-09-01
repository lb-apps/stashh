//
//  ProfileView.swift
//  Stashh
//
//  Created by Emirhan Erdogan on 17/04/2026.
//

import SwiftUI

// MARK: - ProfileView

struct ProfileView: View {

    var body: some View {
        NavigationStack {
            Text("Profile")
                .font(TextStyle.headlineMedium)
                .foregroundStyle(AppColor.labelSecondary)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(AppColor.background)
        }
    }
}

// MARK: - Preview

#Preview {
    ProfileView()
}
