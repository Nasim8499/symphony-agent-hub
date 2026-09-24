import { redirect } from "next/navigation";

export default function SkillsRedirect() {
  redirect("/tasker?tab=skills");
}
