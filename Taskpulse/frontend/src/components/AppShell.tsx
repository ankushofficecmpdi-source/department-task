import { useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { Activity, AlertTriangle, Building2, CalendarRange, KanbanSquare, LayoutDashboard, LogOut, Menu, Plus, Sunrise, Users } from "lucide-react";
import CalendarSyncCard from "@/components/CalendarSyncCard";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import NotificationBell from "@/components/NotificationBell";
import TaskDialog from "@/components/TaskDialog";
import NewTaskDialog from "@/components/NewTaskDialog";
import { Avatar } from "@/components/TaskBits";
import { ApiError } from "@/lib/api";
import { useDashboard, useMe, useTaskDialogs } from "@/lib/hooks";
import { endSession } from "@/lib/session";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard, managerOnly: false },
  { to: "/board", label: "Kanban Board", icon: KanbanSquare, managerOnly: false },
  { to: "/planner", label: "Shift Planner", icon: CalendarRange, managerOnly: false },
  { to: "/departments", label: "Departments", icon: Building2, managerOnly: false },
  { to: "/team", label: "Team", icon: Users, managerOnly: true },
  { to: "/digest", label: "Daily Digest", icon: Sunrise, managerOnly: true },
  { to: "/activity", label: "Activity", icon: Activity, managerOnly: false },
];

const TITLES: Record<string, string> = {
  "/": "Overview",
  "/board": "Kanban Board",
  "/planner": "Shift Planner",
  "/departments": "Departments",
  "/team": "Team",
  "/digest": "Daily Digest",
  "/activity": "Activity",
};

function NavItems({ isManager, onNavigate }: { isManager: boolean; onNavigate?: () => void }) {
  return (
    <nav className="space-y-1">
      {NAV.filter((n) => isManager || !n.managerOnly).map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === "/"}
          onClick={onNavigate}
          data-testid={`nav-link-${n.label.toLowerCase().replace(/\s+/g, "-")}`}
          className={({ isActive }) =>
            cn(
              "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150",
              isActive ? "bg-[#4F46E5] text-white" : "text-slate-400 hover:bg-[#111827] hover:text-white",
            )
          }
        >
          <n.icon className="size-4" />
          {n.label}
        </NavLink>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <span className="relative flex size-8 items-center justify-center rounded-md bg-[#4F46E5]">
        <span className="absolute size-3 rounded-full border-2 border-white" />
        <span className="absolute size-1 rounded-full bg-white" />
      </span>
      <div>
        <p className="font-heading text-[15px] font-extrabold leading-none tracking-tight text-white">TaskPulse</p>
        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-[#818CF8]">Work oversight</p>
      </div>
    </div>
  );
}

export default function AppShell() {
  const me = useMe();
  const dash = useDashboard();
  const location = useLocation();
  const { taskId, newParam, openTask, openNew, close } = useTaskDialogs();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (me.error instanceof ApiError && me.error.status === 401) return <Navigate to="/login" replace />;

  const user = me.data;
  const isManager = user?.role === "manager";
  const overdue = dash.isError ? 0 : (dash.data?.overdue ?? 0);
  const dueSoon = dash.isError ? 0 : (dash.data?.due_soon ?? 0);

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[#1E293B] bg-[#070A10] px-4 py-5 md:flex">
        <Brand />
        <div className="mt-8 flex-1">
          <p className="mb-2 px-3 font-mono text-[10px] uppercase tracking-[0.2em] text-slate-600">Workspace</p>
          <NavItems isManager={isManager} />
        </div>
        {isManager && <CalendarSyncCard />}
        {user && (
          <div className="rounded-lg border border-[#1E293B] bg-[#0B0F17] p-3" data-testid="sidebar-user-card">
            <div className="flex items-center gap-2.5">
              <Avatar id={user.id} name={user.name} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{user.department ?? user.title}</p>
              </div>
            </div>
          </div>
        )}
      </aside>

      <div className="md:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[#1E293B] bg-[#0B0F17]/85 px-4 backdrop-blur-xl md:px-8">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              className="inline-flex size-9 items-center justify-center rounded-md border border-[#1E293B] md:hidden"
              aria-label="Open navigation"
              data-testid="mobile-nav-button"
            >
              <Menu className="size-4" />
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-[#1E293B] bg-[#070A10] p-5">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <Brand />
              <div className="mt-8">
                <NavItems isManager={isManager} onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <div className="min-w-0">
            <h1 className="truncate font-heading text-lg font-bold tracking-tight text-white" data-testid="page-title">
              {TITLES[location.pathname] ?? "TaskPulse"}
            </h1>
          </div>
          {user && (
            <span
              data-testid="role-badge"
              className={cn(
                "hidden rounded-sm border px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider sm:inline-flex",
                isManager ? "border-[#4F46E5]/60 bg-[#4F46E5]/15 text-[#C7D2FE]" : "border-[#0D9488]/60 bg-[#082622] text-[#99F6E4]",
              )}
            >
              {isManager ? "Manager" : "Team member"}
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            {(overdue > 0 || dueSoon > 0) && (
              <NavLink
                to="/"
                data-testid="header-priority-alert-chip"
                className="hidden items-center gap-2 rounded-md border border-[#E11D48]/40 bg-[#2A1215] px-2.5 py-1.5 font-mono text-[11px] font-semibold text-[#FECDD3] transition-colors hover:border-[#E11D48] lg:flex"
              >
                <AlertTriangle className="size-3.5 text-[#FB7185]" />
                {overdue} overdue · {dueSoon} due soon
              </NavLink>
            )}
            {isManager && (
              <Button
                onClick={() => openNew()}
                data-testid="header-assign-task-button"
                className="bg-[#4F46E5] text-white transition-[background-color,transform] duration-150 hover:bg-[#4338CA] active:scale-[0.98]"
              >
                <Plus className="size-4" />
                <span className="hidden sm:inline">Assign task</span>
              </Button>
            )}
            <NotificationBell onOpenTask={openTask} />
            <DropdownMenu>
              <DropdownMenuTrigger
                className="rounded-full transition-transform duration-150 active:scale-95"
                aria-label="Account menu"
                data-testid="user-menu-button"
              >
                {user ? <Avatar id={user.id} name={user.name} size="md" /> : <span className="block size-9 rounded-full bg-[#1E293B]" />}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {user && (
                  <>
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>
                        <p className="text-sm font-semibold text-slate-100">{user.name}</p>
                        <p className="text-xs font-normal text-slate-500">{user.email}</p>
                      </DropdownMenuLabel>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => void endSession()} data-testid="logout-button">
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>

      <TaskDialog taskId={taskId} me={user} onClose={close} />
      {isManager && (
        <NewTaskDialog
          open={!!newParam}
          defaultAssignee={newParam && newParam !== "1" ? newParam : undefined}
          onClose={close}
          onCreated={(t) => openTask(t.id)}
        />
      )}
    </div>
  );
}
