// ---------------------------------------------------------------------------
// lib/ui/messages.ts
// One shared way to show alerts and confirmations on every platform.
//
// Workaround: on React Native Web, Alert.alert() with buttons does nothing,
// so messages silently disappear. On web we fall back to the browser's
// alert()/confirm(); on iOS/Android we use the native Alert.
// ---------------------------------------------------------------------------

import { Alert, Platform } from "react-native";

import { translate } from "../i18n/translate";

export function showMessage(title: string, message?: string): void {
  if (Platform.OS === "web") {
    const text = message ? `${title}\n\n${message}` : title;
    (globalThis as any).alert?.(text);
    return;
  }

  Alert.alert(title, message);
}

type ConfirmOptions = {
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

// Resolves true only when the user explicitly confirms.
export function confirmAction(
  title: string,
  message: string,
  options: ConfirmOptions = {}
): Promise<boolean> {
  if (Platform.OS === "web") {
    return Promise.resolve(
      (globalThis as any).confirm?.(`${title}\n\n${message}`) === true
    );
  }

  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        {
          text: options.cancelText ?? translate("common.cancel"),
          style: "cancel",
          onPress: () => resolve(false),
        },
        {
          text: options.confirmText ?? translate("common.continue"),
          style: options.destructive ? "destructive" : "default",
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
