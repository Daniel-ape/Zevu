import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = HintaopasViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)

        AppShortcuts.install()
        // started from a shortcut on the app icon
        if let item = connectionOptions.shortcutItem { AppShortcuts.open(item) }
    }

    // a shortcut on the app icon while the app was already running
    func windowScene(_ windowScene: UIWindowScene, performActionFor shortcutItem: UIApplicationShortcutItem, completionHandler: @escaping (Bool) -> Void) {
        completionHandler(AppShortcuts.open(shortcutItem))
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// Long-press the app icon: Scan, My list and Search open the app straight on
/// that tab. The web app gets them as fi.hintaopas.app://open/<tab> links, the
/// same as the widget and deep links. Titles follow the phone's language.
enum AppShortcuts {
    static func install() {
        let lang = Locale.preferredLanguages.first?.prefix(2) ?? "sv"
        let t: [String: [String]] = [
            "fi": ["Skannaa", "Ostoslistani", "Hae tuotteita"],
            "en": ["Scan", "My shopping list", "Search products"],
            "sv": ["Skanna", "Min inköpslista", "Sök produkter"],
        ]
        let titles = t[String(lang)] ?? t["sv"]!
        UIApplication.shared.shortcutItems = [
            UIApplicationShortcutItem(type: "scan", localizedTitle: titles[0], localizedSubtitle: nil, icon: UIApplicationShortcutIcon(systemImageName: "barcode.viewfinder")),
            UIApplicationShortcutItem(type: "lists", localizedTitle: titles[1], localizedSubtitle: nil, icon: UIApplicationShortcutIcon(systemImageName: "list.bullet")),
            UIApplicationShortcutItem(type: "search", localizedTitle: titles[2], localizedSubtitle: nil, icon: UIApplicationShortcutIcon(systemImageName: "magnifyingglass")),
        ]
    }

    @discardableResult
    static func open(_ item: UIApplicationShortcutItem) -> Bool {
        guard let url = URL(string: "fi.hintaopas.app://open/\(item.type)") else { return false }
        // the App plugin passes this on as an appUrlOpen event (and as the launch URL on a cold start)
        return ApplicationDelegateProxy.shared.application(UIApplication.shared, open: url, options: [:])
    }
}
