/**
 * /inquire/<slug> when the form is unknown, paused, archived or not published yet (also inside a
 * website's embed iframe). Rendered inside this segment's layout, so it keeps the form's own light
 * palette instead of the hub's 404, which can be dark. Inside an embed it reports its height to the
 * host page (UnavailableNotice), so the frame shrinks to the message.
 */
import { UnavailableNotice } from "@/components/inquiry-forms/public/UnavailableNotice";

export default function InquireNotFound() {
  return <UnavailableNotice />;
}
