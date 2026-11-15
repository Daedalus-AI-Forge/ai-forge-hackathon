import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";

import { api } from "@/convex/_generated/api";
import { AUTH_ENABLED } from "@/lib/authFlag";

const KEY = "wishwell.deviceId";

function randomId() {
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  return "dev_" + bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function useDeviceId() {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let id = await AsyncStorage.getItem(KEY);
      if (!id) {
        id = randomId();
        await AsyncStorage.setItem(KEY, id);
      }
      if (!cancelled) setDeviceId(id);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return deviceId;
}

export function useMe() {
  const deviceId = useDeviceId();
  const ensure = useMutation(api.users.ensure);
  const user = useQuery(api.users.me, deviceId ? { deviceId } : "skip");
  useEffect(() => {
    // With auth on, AuthBridge creates/adopts the row via anonymous sign-in.
    if (!AUTH_ENABLED && deviceId && user === null) void ensure({ deviceId });
  }, [deviceId, user, ensure]);
  return { deviceId, user: user ?? null, loading: !deviceId || user === undefined };
}
