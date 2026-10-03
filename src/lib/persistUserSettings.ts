import { idbSaveUserSettings } from "../localDb";
import { saveUserSettingsToCloud } from "../firebaseDb";

export type UserInstructionSettings = {
  systemInstruction: string;
  chatInstruction: string;
  classifyInstruction: string;
};

export async function persistUserSettings(
  settings: UserInstructionSettings,
  opts: { userId?: string | null; silent?: boolean } = {}
) {
  const updatedAt = Date.now();
  try {
    localStorage.setItem("radiology_sys_inst", settings.systemInstruction);
    localStorage.setItem("radiology_chat_inst", settings.chatInstruction);
    localStorage.setItem("radiology_class_inst", settings.classifyInstruction);
  } catch (e) {
    console.warn("Could not save settings to localStorage:", e);
  }

  await idbSaveUserSettings({ ...settings, updatedAt });

  const activeUserId = opts.userId;
  if (activeUserId) {
    saveUserSettingsToCloud(activeUserId, { ...settings, updatedAt }).catch((err) => {
      console.warn("Could not sync user settings to cloud:", err);
    });
  }

  if (!opts.silent) {
    alert("Instrucciones generales del sistema guardadas y actualizadas correctamente.");
  }
}
