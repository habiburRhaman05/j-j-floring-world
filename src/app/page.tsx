import { redirect } from "next/navigation";

/**
 * The root has nothing to show: the workspace a person belongs in depends on
 * who they are, which the sign-in screen resolves. So the root only forwards.
 */
export default function RootPage() {
  redirect("/login");
}
