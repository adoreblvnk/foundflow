import { notFound, redirect } from "next/navigation";
import { isAuthenticated, getCurrentUser } from "@/lib/auth";
import { getCaseById } from "@/lib/db";
import CaseDetailClient from "./CaseDetailClient";

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const authed = await isAuthenticated();
  if (!authed) {
    redirect("/login");
  }

  const { id } = await params;
  const caseFile = getCaseById(id);
  if (!caseFile) {
    notFound();
  }

  const currentUser = await getCurrentUser();

  return (
    <CaseDetailClient
      initialCase={caseFile}
      currentUser={currentUser!}
    />
  );
}
