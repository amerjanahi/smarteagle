// Biometric (fingerprint / Face ID) helper for the Capacitor mobile build.
// On web it's a no-op. On native it stores the user's credentials in the
// secure enclave / keystore so the app can prompt for biometric unlock.
import { Capacitor } from "@capacitor/core";

const SERVER = "hayy.resident.auth";

type Creds = { username: string; password: string };

export const biometric = {
  isNative(): boolean {
    return Capacitor.isNativePlatform();
  },

  async isAvailable(): Promise<boolean> {
    if (!this.isNative()) return false;
    try {
      const { NativeBiometric } = await import("capacitor-native-biometric");
      const res = await NativeBiometric.isAvailable();
      return !!res.isAvailable;
    } catch { return false; }
  },

  async save(creds: Creds): Promise<void> {
    if (!(await this.isAvailable())) return;
    const { NativeBiometric } = await import("capacitor-native-biometric");
    await NativeBiometric.setCredentials({ ...creds, server: SERVER });
  },

  async clear(): Promise<void> {
    if (!this.isNative()) return;
    try {
      const { NativeBiometric } = await import("capacitor-native-biometric");
      await NativeBiometric.deleteCredentials({ server: SERVER });
    } catch { /* ignore */ }
  },

  async unlock(): Promise<Creds | null> {
    if (!(await this.isAvailable())) return null;
    try {
      const { NativeBiometric } = await import("capacitor-native-biometric");
      await NativeBiometric.verifyIdentity({
        reason: "Unlock Hayy Resident",
        title: "Biometric sign-in",
        subtitle: "Use your fingerprint or Face ID",
      });
      const c = await NativeBiometric.getCredentials({ server: SERVER });
      return { username: c.username, password: c.password };
    } catch { return null; }
  },
};
