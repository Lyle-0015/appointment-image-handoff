export type AppointmentState = "confirmed" | "pending" | "cancelled";

export function shouldSendPatientNotice(state: AppointmentState): boolean {
  return state === "confirmed";
}
