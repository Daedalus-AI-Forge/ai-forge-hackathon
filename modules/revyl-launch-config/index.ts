import { requireOptionalNativeModule } from "expo-modules-core";

type RevylLaunchConfigModule = { get(key: string): string | null };

const native = requireOptionalNativeModule<RevylLaunchConfigModule>("RevylLaunchConfig");

export function launchValue(key: string): string | null {
  return native?.get(key) ?? null;
}
