//
//  PlaceCategoryEmoji.swift
//  Stashh
//

import Foundation

// MARK: - PlaceCategoryEmoji

/// Maps Google Places `primaryType` / stored `category` strings to a display emoji.
enum PlaceCategoryEmoji {

    /// Emoji for map pins and lists. Falls back to 📍 when unknown or empty.
    static func emoji(for category: String?) -> String {
        guard let raw = category?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else {
            return fallback
        }
        let key = raw.lowercased().replacingOccurrences(of: " ", with: "_")
        if let exact = map[key] {
            return exact
        }
        let tokens = key.split(separator: "_").map(String.init)
        guard !tokens.isEmpty else { return fallback }
        for drop in 0..<tokens.count {
            let tail = tokens.dropFirst(drop).joined(separator: "_")
            if let match = map[tail] {
                return match
            }
        }
        return fallback
    }

    private static let fallback = "📍"

    private static let map: [String: String] = [
        "restaurant": "🍽️",
        "meal_takeaway": "🥡",
        "meal_delivery": "🛵",
        "fast_food_restaurant": "🍔",
        "brunch_restaurant": "🥞",
        "breakfast_restaurant": "🥐",
        "pizza_restaurant": "🍕",
        "seafood_restaurant": "🦐",
        "steak_house": "🥩",
        "sushi_restaurant": "🍣",
        "ramen_restaurant": "🍜",
        "barbecue_restaurant": "🍖",
        "middle_eastern_restaurant": "🥙",
        "mediterranean_restaurant": "🫒",
        "italian_restaurant": "🍝",
        "french_restaurant": "🥖",
        "chinese_restaurant": "🥟",
        "japanese_restaurant": "🍱",
        "korean_restaurant": "🍲",
        "thai_restaurant": "🌶️",
        "indian_restaurant": "🍛",
        "mexican_restaurant": "🌮",
        "american_restaurant": "🍴",
        "vegan_restaurant": "🥗",
        "vegetarian_restaurant": "🥗",
        "cafe": "☕",
        "coffee_shop": "☕",
        "tea_house": "🍵",
        "bakery": "🥐",
        "dessert_shop": "🍰",
        "ice_cream_shop": "🍦",
        "confectionery": "🍬",
        "bar": "🍸",
        "wine_bar": "🍷",
        "pub": "🍺",
        "night_club": "💃",
        "liquor_store": "🍾",
        "grocery_store": "🛒",
        "supermarket": "🛒",
        "convenience_store": "🏪",
        "food": "🍴",
        "food_store": "🥫",
        "meal_delivery_service": "🛵",
        "hotel": "🏨",
        "lodging": "🛏️",
        "motel": "🏨",
        "hostel": "🛏️",
        "resort_hotel": "🏝️",
        "spa": "💆",
        "beauty_salon": "💇",
        "hair_care": "💈",
        "gym": "🏋️",
        "fitness_center": "🏋️",
        "yoga_studio": "🧘",
        "swimming_pool": "🏊",
        "park": "🌳",
        "national_park": "🏞️",
        "campground": "⛺",
        "hiking_area": "🥾",
        "tourist_attraction": "🎡",
        "museum": "🏛️",
        "art_gallery": "🖼️",
        "historical_landmark": "🏰",
        "monument": "🗿",
        "zoo": "🦁",
        "aquarium": "🐠",
        "amusement_park": "🎢",
        "movie_theater": "🎬",
        "performing_arts_theater": "🎭",
        "stadium": "🏟️",
        "library": "📚",
        "book_store": "📖",
        "school": "🏫",
        "university": "🎓",
        "church": "⛪",
        "mosque": "🕌",
        "synagogue": "🕍",
        "hindu_temple": "🛕",
        "shopping_mall": "🏬",
        "department_store": "🛍️",
        "clothing_store": "👗",
        "shoe_store": "👟",
        "jewelry_store": "💎",
        "electronics_store": "📱",
        "furniture_store": "🛋️",
        "home_goods_store": "🏺",
        "hardware_store": "🔧",
        "florist": "💐",
        "pet_store": "🐾",
        "veterinary_care": "🐕",
        "hospital": "🏥",
        "pharmacy": "💊",
        "doctor": "🩺",
        "dentist": "🦷",
        "physiotherapist": "🧑‍⚕️",
        "gas_station": "⛽",
        "electric_vehicle_charging_station": "🔌",
        "parking": "🅿️",
        "car_dealer": "🚗",
        "car_rental": "🚙",
        "car_repair": "🔧",
        "car_wash": "🧽",
        "subway_station": "🚇",
        "bus_station": "🚌",
        "train_station": "🚉",
        "transit_station": "🚉",
        "light_rail_station": "🚈",
        "airport": "✈️",
        "ferry_terminal": "⛴️",
        "taxi_stand": "🚕",
        "bank": "🏦",
        "atm": "🏧",
        "post_office": "📮",
        "embassy": "🏛️",
        "city_hall": "🏛️",
        "courthouse": "⚖️",
        "police": "👮",
        "fire_station": "🚒",
        "local_government_office": "🏢",
        "real_estate_agency": "🏠",
        "travel_agency": "🧳",
        "insurance_agency": "📋",
        "lawyer": "⚖️",
        "accounting": "🧮",
        "store": "🏪",
        "point_of_interest": "⭐",
        "establishment": "🏢",
        "food_and_drink": "🍴",
        "nightlife": "🌃",
        "event_venue": "🎉",
        "wedding_venue": "💒",
        "banquet_hall": "🎊",
        "bowling_alley": "🎳",
        "casino": "🎰",
        "rv_park": "🚐",
        "marina": "⛵",
        "beach": "🏖️",
    ]
}
