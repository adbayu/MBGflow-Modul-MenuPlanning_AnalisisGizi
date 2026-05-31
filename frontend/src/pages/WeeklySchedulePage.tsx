import type { PageView } from "../types";
import DashboardPage from "./DashboardPage";

interface WeeklySchedulePageProps {
  onNavigate: (p: PageView) => void;
}

export default function WeeklySchedulePage({
  onNavigate,
}: WeeklySchedulePageProps) {
  return <DashboardPage onNavigate={onNavigate} mode="weekly" />;
}
