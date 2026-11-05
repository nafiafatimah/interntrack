"use client";

import {
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

import { supabase } from "../lib/supabase";

import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  ClipboardList,
  ChartColumn,
  LogOut,
  Clock,
  CalendarDays,
  User,
  ArrowUpRight,
  CheckCircle2,
  Loader2,
  BriefcaseBusiness,
  ShieldCheck,
  Lock,
  Mail,
} from "lucide-react";

// ==========================================
// TYPES
// ==========================================

type Profile = {
  id: string;
  full_name: string;
  email: string;
  role: "admin" | "intern";
  division: string;
};

type Attendance = {
  id: string | number;
  attendance_date: string;
  check_in: string | null;
  check_out: string | null;
  status: string;
};

type DashboardStats = {
  interns: number;
  present: number;
  late: number;
  activities: number;
};

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function formatTime(value: string | null): string {
  if (!value) return "--:--";

  return new Date(value).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}

// ==========================================
// MAIN PAGE
// ==========================================

export default function Home() {
  // Authentication
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // Attendance
  const [attendance, setAttendance] = useState<Attendance[]>([]);

  // Admin statistics
  const [stats, setStats] = useState<DashboardStats>({
    interns: 0,
    present: 0,
    late: 0,
    activities: 0,
  });

  // Jakarta date
  const [today, setToday] = useState("");
  const [dateLabel, setDateLabel] = useState("");

  // ==========================================
  // INITIALIZE DATE
  // ==========================================

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const currentDate = new Date();

      const jakartaDate = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
      }).format(currentDate);

      const formattedDate = new Intl.DateTimeFormat("id-ID", {
        dateStyle: "full",
        timeZone: "Asia/Jakarta",
      }).format(currentDate);

      setToday(jakartaDate);
      setDateLabel(formattedDate);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  // ==========================================
  // LOAD DASHBOARD
  // ==========================================

  const loadDashboard = useCallback(
    async (userId: string) => {
      if (!today) return;

      setError("");

      // Get profile
      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (profileError || !profileData) {
        setError(
          "Profile not found. Please make sure this account exists in the profiles table."
        );

        setProfile(null);
        await supabase.auth.signOut();
        return;
      }

      const userProfile = profileData as Profile;

      setProfile(userProfile);

      // INTERN DASHBOARD
      if (userProfile.role === "intern") {
        const {
          data,
          error: attendanceError,
        } = await supabase
          .from("attendances")
          .select("*")
          .eq("user_id", userId)
          .order("attendance_date", { ascending: false })
          .limit(7);

        if (attendanceError) {
          setError(attendanceError.message);
          setAttendance([]);
          return;
        }

        setAttendance((data || []) as Attendance[]);
      }

      // ADMIN DASHBOARD
      if (userProfile.role === "admin") {
        const [
          internResult,
          attendanceResult,
          activityResult,
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("role", "intern"),

          supabase
            .from("attendances")
            .select("status")
            .eq("attendance_date", today),

          supabase
            .from("daily_activities")
            .select("id", {
              count: "exact",
              head: true,
            })
            .eq("activity_date", today),
        ]);

        if (internResult.error) {
          setError(internResult.error.message);
        }

        if (attendanceResult.error) {
          setError(attendanceResult.error.message);
        }

        if (activityResult.error) {
          setError(activityResult.error.message);
        }

        const records = attendanceResult.data || [];

        setStats({
          interns: internResult.count || 0,
          present: records.length,
          late: records.filter(
            (item: { status: string }) => item.status === "late"
          ).length,
          activities: activityResult.count || 0,
        });

        setAttendance([]);
      }
    },
    [today]
  );

  // ==========================================
  // AUTH SESSION
  // ==========================================

  useEffect(() => {
    if (!today) return;

    let mounted = true;

    async function initializeApp() {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          throw sessionError;
        }

        if (mounted && session?.user) {
          await loadDashboard(session.user.id);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to initialize the application."
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void initializeApp();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setProfile(null);
        setAttendance([]);
        setStats({
          interns: 0,
          present: 0,
          late: 0,
          activities: 0,
        });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [today, loadDashboard]);

  // ==========================================
  // LOGIN
  // ==========================================

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setError("");
    setSubmitting(true);

    try {
      const {
        data,
        error: loginError,
      } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        throw loginError;
      }

      if (data.user) {
        await loadDashboard(data.user.id);
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Login failed. Please check your email and password."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  async function handleLogout() {
    setError("");

    const { error: logoutError } = await supabase.auth.signOut();

    if (logoutError) {
      setError(logoutError.message);
      return;
    }

    setProfile(null);
    setPassword("");
    setEmail("");
    setAttendance([]);
  }

  // ==========================================
  // CHECK IN
  // ==========================================

  async function handleCheckIn() {
    if (!profile || submitting) return;

    setError("");
    setSubmitting(true);

    try {
      const { error: checkInError } =
        await supabase.rpc("check_in");

      if (checkInError) {
        throw checkInError;
      }

      await loadDashboard(profile.id);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to check in."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ==========================================
  // CHECK OUT
  // ==========================================

  async function handleCheckOut() {
    if (!profile || submitting) return;

    setError("");
    setSubmitting(true);

    try {
      const { error: checkOutError } =
        await supabase.rpc("check_out");

      if (checkOutError) {
        throw checkOutError;
      }

      await loadDashboard(profile.id);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to check out."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ==========================================
  // TODAY ATTENDANCE
  // ==========================================

  const todayAttendance = attendance.find(
    (item: Attendance) => item.attendance_date === today
  );

  // Helper function to resolve intern attendance message securely
  const getAttendanceStatusText = () => {
    if (!todayAttendance) return "Not Checked In";
    if (todayAttendance.check_out) return "Completed";
    if (todayAttendance.status === "late") return "Checked In &middot; Late";
    return "Checked In &middot; On Time";
  };

  const getAttendanceSubtext = () => {
    if (!todayAttendance) return "Don't forget to record your attendance today.";
    if (todayAttendance.check_out) return "Your attendance for today is complete.";
    return "Your check-in has been recorded successfully.";
  };

  // ==========================================
  // LOADING SCREEN
  // ==========================================

  if (loading || !today) {
    return (
      <div className="loading-screen">
        <Loader2 className="spin" size={34} />
        <p>Preparing InternTrack...</p>
      </div>
    );
  }

  // ==========================================
  // LOGIN PAGE
  // ==========================================

  if (!profile) {
    return (
      <main className="login-page">
        <div className="login-decoration decoration-one" />
        <div className="login-decoration decoration-two" />

        <section className="login-container">
          <div className="login-brand">
            <div className="brand-icon">
              <BriefcaseBusiness size={25} />
            </div>

            <span>
              Intern<span className="brand-accent">Track</span>
            </span>
          </div>

          <div className="login-card">
            <div className="login-icon">
              <ShieldCheck size={28} />
            </div>

            <p className="eyebrow">
              INTERNSHIP MANAGEMENT SYSTEM
            </p>

            <h1>Welcome back!</h1>

            <p className="login-subtitle">
              Sign in to manage your internship attendance and activities.
            </p>

            <form onSubmit={handleLogin}>
              <label htmlFor="email-input">
                Email address
              </label>

              <div className="input-wrapper">
                <Mail size={18} />

                <input
                  id="email-input"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </div>

              <label htmlFor="password-input">
                Password
              </label>

              <div className="input-wrapper">
                <Lock size={18} />

                <input
                  id="password-input"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="login-button"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="spin" size={19} />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <ArrowUpRight size={19} />
                  </>
                )}
              </button>
            </form>

            <div className="login-security">
              <ShieldCheck size={16} />
              Secure access for administrators and interns
            </div>
          </div>

          <p className="login-footer">
            &copy; 2026 InternTrack. Internship Attendance Management.
          </p>
        </section>
      </main>
    );
  }

  // ==========================================
  // DASHBOARD
  // ==========================================

  return (
    <div className="dashboard-layout">

      {/* SIDEBAR */}

      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">
            <BriefcaseBusiness size={23} />
          </div>

          <span>
            Intern<span className="brand-accent">Track</span>
          </span>
        </div>

        <div className="sidebar-label">
          MAIN MENU
        </div>

        <nav className="sidebar-nav">
          <a className="nav-item active" href="#dashboard">
            <LayoutDashboard size={19} />
            Dashboard
          </a>

          {profile.role === "admin" ? (
            <>
              <a className="nav-item" href="#interns">
                <Users size={19} />
                Intern Management
              </a>

              <a className="nav-item" href="#attendance">
                <CalendarCheck size={19} />
                Attendance
              </a>

              <a className="nav-item" href="#activities">
                <ClipboardList size={19} />
                Daily Activities
              </a>

              <a className="nav-item" href="#reports">
                <ChartColumn size={19} />
                Reports
              </a>
            </>
          ) : (
            <>
              <a className="nav-item" href="#my-attendance">
                <CalendarCheck size={19} />
                My Attendance
              </a>

              <a className="nav-item" href="#my-activities">
                <ClipboardList size={19} />
                Daily Activities
              </a>

              <a className="nav-item" href="#my-profile">
                <User size={19} />
                My Profile
              </a>
            </>
          )}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <div className="avatar">
              {profile.full_name.charAt(0)}
            </div>

            <div className="sidebar-user-info">
              <strong>{profile.full_name}</strong>

              <span>
                {profile.role === "admin"
                  ? "Administrator"
                  : "Intern"}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="logout-button"
            onClick={handleLogout}
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}

      <main className="dashboard-main">

        {/* TOPBAR */}

        <header className="topbar">
          <div>
            <span className="breadcrumb">
              Workspace / Dashboard
            </span>

            <h2>Dashboard</h2>
          </div>

          <div className="topbar-date">
            <CalendarDays size={17} />
            {dateLabel}
          </div>
        </header>

        {/* WELCOME */}

        <div className="welcome-section">
          <div>
            <p className="eyebrow">OVERVIEW</p>

            <h1>
              Hello, {profile.full_name.split(" ")[0]}! 👋
            </h1>

            <p>
              {profile.role === "admin"
                ? "Here&apos;s what&apos;s happening with your interns today."
                : "Ready to make today productive? Let&apos;s get started."}
            </p>
          </div>

          <div className="welcome-badge">
            <ShieldCheck size={17} />

            {profile.role === "admin"
              ? "Admin Account"
              : "Intern Account"}
          </div>
        </div>

        {/* ERROR */}

        {error && (
          <div className="error-message dashboard-error">
            {error}
          </div>
        )}

        {/* ======================================
            ADMIN DASHBOARD
        ====================================== */}

        {profile.role === "admin" ? (
          <>
            <div className="section-heading">
              <h3>Attendance Overview</h3>
              <span>Today&apos;s summary</span>
            </div>

            {/* STATISTICS */}

            <div className="stats-grid">
              <StatCard
                title="Total Interns"
                value={stats.interns}
                icon={<Users />}
                color="blue"
              />

              <StatCard
                title="Present Today"
                value={stats.present}
                icon={<CheckCircle2 />}
                color="green"
              />

              <StatCard
                title="Late Arrivals"
                value={stats.late}
                icon={<Clock />}
                color="orange"
              />

              <StatCard
                title="Daily Activities"
                value={stats.activities}
                icon={<ClipboardList />}
                color="purple"
              />
            </div>

            {/* QUICK OVERVIEW */}

            <div className="content-card">
              <div className="card-heading">
                <div>
                  <h3>Quick Overview</h3>
                  <p>Live attendance statistics</p>
                </div>

                <span className="live-indicator">
                  ● Live Data
                </span>
              </div>

              <div className="admin-overview">
                <div className="overview-item">
                  <span>Total Participants</span>
                  <strong>{stats.interns}</strong>
                  <small>Registered interns</small>
                </div>

                <div className="overview-item">
                  <span>Attendance Rate</span>

                  <strong>
                    {stats.interns
                      ? Math.round(
                          (stats.present / stats.interns) * 100
                        )
                      : 0}
                    %
                  </strong>

                  <small>Based on registered interns</small>
                </div>

                <div className="overview-item">
                  <span>On-time Attendance</span>

                  <strong>
                    {stats.present - stats.late}
                  </strong>

                  <small>Arrived before 08:00</small>
                </div>
              </div>
            </div>

            {/* MANAGEMENT CENTER */}

            <div className="content-card">
              <div className="card-heading">
                <div>
                  <h3>Management Center</h3>
                  <p>Manage your internship operations</p>
                </div>
              </div>

              <div className="quick-grid">
                <QuickLink
                  icon={<Users />}
                  title="Intern Management"
                  desc="Manage participant profiles"
                />

                <QuickLink
                  icon={<CalendarCheck />}
                  title="Attendance"
                  desc="Monitor daily attendance"
                />

                <QuickLink
                  icon={<ClipboardList />}
                  title="Daily Activities"
                  desc="Review intern activities"
                />

                <QuickLink
                  icon={<ChartColumn />}
                  title="Reports"
                  desc="View attendance reports"
                />
              </div>
            </div>
          </>
        ) : (

          /* ======================================
              INTERN DASHBOARD
          ====================================== */

          <>
            {/* INTERN INFORMATION */}

            <div className="intern-info">
              <div>
                <span>YOUR DEPARTMENT</span>
                <h3>{profile.division || "General"}</h3>
              </div>

              <div>
                <span>ACCOUNT STATUS</span>
                <h3 className="active-text">
                  ● Active
                </h3>
              </div>
            </div>

            {/* TODAY&apos;S ATTENDANCE */}

            <div className="section-heading">
              <h3>Today&apos;s Attendance</h3>
              <span>{dateLabel}</span>
            </div>

            <div className="attendance-action-card">

              {/* ATTENDANCE STATUS */}

              <div className="attendance-status">
                <div>
                  <p className="eyebrow">
                    ATTENDANCE STATUS
                  </p>

                  <h2>{getAttendanceStatusText()}</h2>
                  <p>{getAttendanceSubtext()}</p>
                </div>

                <div className="status-icon">
                  {todayAttendance?.check_out ? (
                    <CheckCircle2 size={34} />
                  ) : (
                    <Clock size={34} />
                  )}
                </div>
              </div>

              {/* TIME */}

              <div className="time-grid">
                <div className="time-box">
                  <span>
                    <ArrowUpRight size={16} />
                    CHECK IN
                  </span>

                  <strong>
                    {formatTime(
                      todayAttendance?.check_in || null
                    )}
                  </strong>
                </div>

                <div className="time-box">
                  <span>
                    <LogOut size={16} />
                    CHECK OUT
                  </span>

                  <strong>
                    {formatTime(
                      todayAttendance?.check_out || null
                    )}
                  </strong>
                </div>
              </div>

              {/* BUTTONS */}

              <div className="attendance-buttons">
                <button
                  type="button"
                  className="checkin-button"
                  onClick={() => void handleCheckIn()}
                  disabled={!!todayAttendance || submitting}
                >
                  {submitting ? (
                    <Loader2 className="spin" size={19} />
                  ) : (
                    <ArrowUpRight size={19} />
                  )}

                  Check In
                </button>

                <button
                  type="button"
                  className="checkout-button"
                  onClick={() => void handleCheckOut()}
                  disabled={
                    !todayAttendance ||
                    !!todayAttendance.check_out ||
                    submitting
                  }
                >
                  {submitting ? (
                    <Loader2 className="spin" size={19} />
                  ) : (
                    <LogOut size={19} />
                  )}

                  Check Out
                </button>
              </div>
            </div>

            {/* ATTENDANCE HISTORY */}

            <div className="content-card">
              <div className="card-heading">
                <div>
                  <h3>Recent Attendance</h3>
                  <p>Your latest attendance records</p>
                </div>

                <span className="live-indicator">
                  ● Updated
                </span>
              </div>

              {attendance.length === 0 ? (
                <div className="empty-state">
                  <CalendarDays size={35} />
                  <p>No attendance records yet.</p>
                </div>
              ) : (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Check In</th>
                        <th>Check Out</th>
                        <th>Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {attendance.map((item) => (
                        <tr key={item.id}>
                          <td>{item.attendance_date}</td>

                          <td>
                            {formatTime(item.check_in)}
                          </td>

                          <td>
                            {formatTime(item.check_out)}
                          </td>

                          <td>
                            <span
                              className={`status-pill ${item.status}`}
                            >
                              {item.status === "late"
                                ? "Late"
                                : "Present"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* FOOTER */}

        <footer className="dashboard-footer">
          InternTrack &copy; 2026 &middot; Internship Attendance Management System
        </footer>
      </main>
    </div>
  );
}

// ==========================================
// STAT CARD
// ==========================================

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  readonly title: string;
  readonly value: number;
  readonly icon: ReactNode;
  readonly color: string;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>
        {icon}
      </div>

      <span>{title}</span>
      <strong>{value}</strong>
      <small>Updated today</small>
    </div>
  );
}

// ==========================================
// QUICK LINK
// ==========================================

function QuickLink({
  icon,
  title,
  desc,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly desc: string;
}) {
  return (
    <div className="quick-link">
      <div className="quick-icon">
        {icon}
      </div>

      <div>
        <strong>{title}</strong>
        <p>{desc}</p>
      </div>

      <ArrowUpRight size={17} />
    </div>
  );
}