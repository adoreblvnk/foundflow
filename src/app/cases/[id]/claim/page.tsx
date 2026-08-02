import { notFound, redirect } from "next/navigation";
import { getCurrentUser, isAuthenticated } from "@/lib/auth";
import { getCaseById } from "@/lib/db";
import ClaimWorkflow from "./ClaimWorkflow";

export default async function ClaimPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthenticated())) redirect("/login");
  const { id } = await params;
  const caseFile = await getCaseById(id);
  if (!caseFile) notFound();
  const user = await getCurrentUser();
  return <ClaimWorkflow initialCase={caseFile} currentUser={user!} />;
}
