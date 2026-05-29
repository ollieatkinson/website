import Testing
@testable import Website

@Test func siteMetadataMatchesDomain() {
    let site = Website()

    #expect(site.name == "olbo.dev")
    #expect(site.url.absoluteString == "https://olbo.dev")
    #expect(site.author == "Oliver Atkinson")
}
