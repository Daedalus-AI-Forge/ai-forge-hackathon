// F3 owns this file. Skeleton placeholder with the agreed props.
import { Text } from "react-native";
import type { FinishResult } from "@/lib/linkApi.types";
export type ContactStepProps = { hopId: string; deviceId: string; wishText: string | null; onDone: (r: FinishResult) => void };
export function ContactStep(_p: ContactStepProps) { return <Text>Contact</Text>; }
