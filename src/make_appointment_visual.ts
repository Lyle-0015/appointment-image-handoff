import { createAppointmentVisual } from "./appointment_image_route";

const result = await createAppointmentVisual({
  appointmentId: "visit-1042",
  state: "confirmed",
  careTopic: "post-visit hydration",
});

console.log(result);
