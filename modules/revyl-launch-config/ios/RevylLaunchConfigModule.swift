import ExpoModulesCore

public class RevylLaunchConfigModule: Module {
  public func definition() -> ModuleDefinition {
    Name("RevylLaunchConfig")

    Function("get") { (key: String) -> String? in
      let args = ProcessInfo.processInfo.arguments
      if let index = args.firstIndex(of: "-" + key), index + 1 < args.count {
        return args[index + 1]
      }
      return ProcessInfo.processInfo.environment[key] ?? UserDefaults.standard.string(forKey: key)
    }
  }
}
