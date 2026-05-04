import Foundation

struct HomeContent {
    var canvasID: String
    var brand: Brand
    var profileLinks: [ProfileLink]
    var eyebrow: String
    var title: String
    var lede: String
    var focusAreas: [String]
    var notes: [String]

    static let oliver = HomeContent(
        canvasID: "swarm-field",
        brand: Brand(mark: "ol", title: "olbo.dev", href: "/"),
        profileLinks: [
            ProfileLink(
                title: "GitHub",
                mark: "GH",
                href: URL(string: "https://github.com/ollieatkinson")!,
                icon: "/icons/github.svg"
            ),
            ProfileLink(
                title: "LinkedIn",
                mark: "in",
                href: URL(string: "https://www.linkedin.com/in/oliveratkinson/")!,
                icon: "/icons/linkedin.svg",
                markClass: "linkedin-mark"
            )
        ],
        eyebrow: "olbo.dev",
        title: "Oliver Atkinson",
        lede: "I make things in Swift, mostly on macOS. These days that means system extensions, security tooling, and the rough edges you meet when software gets close to the OS. Previous life: iOS apps.",
        focusAreas: [
            "Swift on macOS",
            "System extensions",
            "Endpoint security",
            "Small tools"
        ],
        notes: [
            "UK",
            "Apple platforms",
            "Built with Swift"
        ]
    )
}

struct Brand {
    var mark: String
    var title: String
    var href: String
}

struct ProfileLink {
    var title: String
    var mark: String
    var href: URL
    var icon: String?
    var markClass: String?
}
