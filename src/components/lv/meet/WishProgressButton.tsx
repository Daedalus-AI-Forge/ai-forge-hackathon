import { useRouter } from "expo-router";

import { DButton } from "@/components/lv/passon/kit";

export function WishProgressButton({
  wishId,
  title = "Check wish progress",
  testID,
  tone,
}: {
  wishId: string;
  title?: string;
  testID: string;
  tone?: "night";
}) {
  const router = useRouter();
  return (
    <DButton
      title={title}
      variant="ghost"
      size="sm"
      tone={tone}
      testID={testID}
      onPress={() => router.push({ pathname: "/e/[wishId]", params: { wishId } })}
    />
  );
}
