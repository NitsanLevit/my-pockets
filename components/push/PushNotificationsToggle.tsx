"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, BellOff, BellRing } from "lucide-react";
import { urlBase64ToUint8Array } from "@/lib/push";

type Status = "checking" | "unsupported" | "subscribed" | "unsubscribed" | "busy" | "error";

export function PushNotificationsToggle() {
  const t = useTranslations("pushNotifications");
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setStatus(sub ? "subscribed" : "unsubscribed");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    check();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setStatus("busy");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("unsubscribed");
        return;
      }

      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("Missing VAPID public key");

      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!res.ok) throw new Error("Subscribe request failed");

      setStatus("subscribed");
    } catch {
      setStatus("error");
    }
  }

  async function disable() {
    setStatus("busy");
    try {
      const reg = await navigator.serviceWorker.ready;
      const subscription = await reg.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setStatus("unsubscribed");
    } catch {
      setStatus("error");
    }
  }

  if (status === "checking") return null;

  if (status === "unsupported") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-foreground/60" title={t("unsupported")}>
        <BellOff className="h-4 w-4" aria-hidden />
      </span>
    );
  }

  if (status === "subscribed") {
    return (
      <button
        onClick={disable}
        title={t("disable")}
        className="on-light inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-2.5 py-1.5 text-xs font-medium text-success shadow-md transition-colors hover:bg-surface-muted"
      >
        <BellRing className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  return (
    <button
      onClick={enable}
      disabled={status === "busy"}
      title={status === "error" ? t("error") : t("enable")}
      className="on-light inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground/85 shadow-md transition-colors hover:bg-surface-muted disabled:opacity-60"
    >
      <Bell className="h-4 w-4" aria-hidden />
    </button>
  );
}
