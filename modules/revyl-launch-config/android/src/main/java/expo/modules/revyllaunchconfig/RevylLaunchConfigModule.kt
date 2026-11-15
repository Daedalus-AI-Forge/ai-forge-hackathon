package expo.modules.revyllaunchconfig

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class RevylLaunchConfigModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("RevylLaunchConfig")

    Function("get") { key: String ->
      @Suppress("DEPRECATION")
      appContext.currentActivity?.intent?.extras?.get(key)?.toString()
    }
  }
}
