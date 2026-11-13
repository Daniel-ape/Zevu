import UIKit
import SwiftUI
import Capacitor

// Native tab bar for iPhone. On iOS 26 it is drawn with Apple's own Liquid Glass
// material (glassEffect): real lensing, specular highlights and the interactive
// press response. Older iOS versions get the system ultra-thin material.
// The web app tells it which tabs to show and which one is selected; taps are
// sent back to the web app as "tap" events.

final class DockModel: ObservableObject {
    struct Tab: Identifiable, Equatable {
        let id: String
        let label: String
        let icon: String
    }
    @Published var tabs: [Tab] = []
    @Published var selected: String = ""
    @Published var badges: Set<String> = []
    @Published var scanLabel: String = "Scan"
    var onTap: (String) -> Void = { _ in }
}

private let accent = Color(UIColor { traits in
    traits.userInterfaceStyle == .dark
        ? UIColor(red: 0x34 / 255, green: 0xD1 / 255, blue: 0x7F / 255, alpha: 1)
        : UIColor(red: 0x0E / 255, green: 0x9A / 255, blue: 0x57 / 255, alpha: 1)
})

struct DockView: View {
    @ObservedObject var model: DockModel
    @Namespace private var selection

    var body: some View {
        content
            .padding(.horizontal, 14)
            .frame(maxWidth: .infinity)
    }

    @ViewBuilder private var content: some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            GlassEffectContainer(spacing: 10) {
                HStack(spacing: 10) {
                    bar
                        .padding(4)
                        .glassEffect(.regular.interactive(), in: .capsule)
                    scan
                        .glassEffect(.regular.interactive(), in: .circle)
                }
            }
        } else {
            fallback
        }
        #else
        fallback
        #endif
    }

    private var fallback: some View {
        HStack(spacing: 10) {
            bar
                .padding(4)
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(Capsule().strokeBorder(Color.white.opacity(0.35), lineWidth: 0.5))
                .shadow(color: .black.opacity(0.12), radius: 14, y: 6)
            scan
                .background(.ultraThinMaterial, in: Circle())
                .overlay(Circle().strokeBorder(Color.white.opacity(0.35), lineWidth: 0.5))
                .shadow(color: .black.opacity(0.12), radius: 14, y: 6)
        }
    }

    private var bar: some View {
        HStack(spacing: 0) {
            ForEach(model.tabs) { tab in
                Button {
                    model.onTap(tab.id)
                } label: {
                    VStack(spacing: 2) {
                        Image(systemName: tab.icon)
                            .font(.system(size: 19, weight: .medium))
                            .frame(height: 24)
                            .overlay(alignment: .topTrailing) {
                                if model.badges.contains(tab.id) {
                                    Circle().fill(accent).frame(width: 8, height: 8).offset(x: 5, y: -1)
                                }
                            }
                        Text(tab.label)
                            .font(.system(size: 10, weight: .semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.8)
                    }
                    .foregroundStyle(model.selected == tab.id ? accent : Color.primary)
                    .frame(maxWidth: .infinity, minHeight: 54)
                    .background {
                        if model.selected == tab.id {
                            // kept a little inside the tab, so it never reaches past the bar's rounded edge
                            Capsule()
                                .fill(Color.primary.opacity(0.09))
                                .padding(.horizontal, 2)
                                .padding(.vertical, 1)
                                .matchedGeometryEffect(id: "sel", in: selection)
                        }
                    }
                    .contentShape(Capsule())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(tab.label)
                .accessibilityAddTraits(model.selected == tab.id ? .isSelected : [])
            }
        }
        .animation(.spring(response: 0.35, dampingFraction: 0.78), value: model.selected)
    }

    private var scan: some View {
        Button {
            model.onTap("scan")
        } label: {
            Image(systemName: "barcode.viewfinder")
                .font(.system(size: 24, weight: .medium))
                .foregroundStyle(model.selected == "scan" ? Color.white : accent)
                .frame(width: 62, height: 62)
                .background {
                    if model.selected == "scan" { Circle().fill(accent) }
                }
                .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(model.scanLabel)
    }
}

@objc(NativeDockPlugin)
public class NativeDockPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeDockPlugin"
    public let jsName = "NativeDock"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "hide", returnType: CAPPluginReturnPromise),
    ]

    private let model = DockModel()
    private var host: UIHostingController<DockView>?
    private let haptic = UISelectionFeedbackGenerator()

    /// show({ tabs: [{id, label, icon}], selected, badges: [id], scanLabel })
    /// Installs the dock on first call; later calls just update it.
    @objc func show(_ call: CAPPluginCall) {
        let tabs: [DockModel.Tab] = (call.getArray("tabs", JSObject.self) ?? []).compactMap { obj in
            guard let id = obj["id"] as? String else { return nil }
            return DockModel.Tab(id: id, label: obj["label"] as? String ?? id, icon: obj["icon"] as? String ?? "circle")
        }
        let selected = call.getString("selected") ?? ""
        let badges = Set(call.getArray("badges", String.self) ?? [])
        let scanLabel = call.getString("scanLabel")
        DispatchQueue.main.async {
            self.install()
            if !tabs.isEmpty && tabs != self.model.tabs { self.model.tabs = tabs }
            if selected != self.model.selected { self.model.selected = selected }
            if badges != self.model.badges { self.model.badges = badges }
            if let scanLabel { self.model.scanLabel = scanLabel }
            self.host?.view.isHidden = false
            call.resolve()
        }
    }

    @objc func hide(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.host?.view.isHidden = true
            call.resolve()
        }
    }

    private func install() {
        guard host == nil, let vc = bridge?.viewController else { return }
        model.onTap = { [weak self] id in
            guard let self else { return }
            self.haptic.selectionChanged()
            self.notifyListeners("tap", data: ["id": id])
        }
        let hosting = UIHostingController(rootView: DockView(model: model))
        hosting.view.backgroundColor = .clear
        hosting.view.translatesAutoresizingMaskIntoConstraints = false
        vc.addChild(hosting)
        vc.view.addSubview(hosting.view)
        NSLayoutConstraint.activate([
            hosting.view.leadingAnchor.constraint(equalTo: vc.view.leadingAnchor),
            hosting.view.trailingAnchor.constraint(equalTo: vc.view.trailingAnchor),
            hosting.view.bottomAnchor.constraint(equalTo: vc.view.safeAreaLayoutGuide.bottomAnchor, constant: -2),
            hosting.view.heightAnchor.constraint(equalToConstant: 66),
        ])
        hosting.didMove(toParent: vc)
        host = hosting
    }
}

/// Bridge view controller that registers the app's own native plugins.
class HintaopasViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(NativeDockPlugin())
        // The page scrolls up and down only: no sideways drag or bounce of the whole page.
        if let scroll = webView?.scrollView {
            scroll.alwaysBounceHorizontal = false
            scroll.showsHorizontalScrollIndicator = false
            scroll.showsVerticalScrollIndicator = false
            scroll.isDirectionalLockEnabled = true
        }
    }
}
