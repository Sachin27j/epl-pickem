import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import apiClient from "../api/client";
import { useAuth } from "../auth/use-auth";

interface LeagueMember {
  id: string;
  userId: string;
  role: "ADMIN" | "PLAYER";
  user: {
    id: string;
    name: string;
  };
}

interface Gameweek {
  id: string;
  number: number;
  deadline: string;
  status: "UPCOMING" | "OPEN" | "LOCKED" | "REVEALED";
}

interface Season {
  id: string;
  name: string;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED";
  gameweeks: Gameweek[];
}

interface League {
  id: string;
  name: string;
  inviteCode: string;
  members: LeagueMember[];
  seasons: Season[];
}

function formatDeadline(deadline: string) {
  return new Date(deadline).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusClasses(status: Gameweek["status"]) {
  switch (status) {
    case "OPEN":
      return "bg-green-100 text-green-700";
    case "LOCKED":
      return "bg-amber-100 text-amber-700";
    case "REVEALED":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function seasonStatusClasses(status: Season["status"]) {
  switch (status) {
    case "ACTIVE":
      return "bg-green-100 text-green-700";
    case "COMPLETED":
      return "bg-blue-100 text-blue-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

export default function LeaguePage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const { user } = useAuth();

  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [seasonName, setSeasonName] = useState("");
  const [creatingSeason, setCreatingSeason] = useState(false);
  const [seasonMessage, setSeasonMessage] = useState("");

  const [activatingSeasonId, setActivatingSeasonId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!leagueId) {
      return;
    }

    let cancelled = false;

    async function fetchLeague() {
      try {
        const response = await apiClient.get<League>(`/league/${leagueId}`);

        if (!cancelled) {
          setLeague(response.data);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load this league.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchLeague();

    return () => {
      cancelled = true;
    };
  }, [leagueId]);

  async function refreshLeague() {
    if (!leagueId) {
      return;
    }

    const response = await apiClient.get<League>(`/league/${leagueId}`);
    setLeague(response.data);
  }

  if (!leagueId) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
            League not found.
          </p>

          <Link
            to="/leagues"
            className="mt-4 inline-block text-sm font-medium text-slate-900 underline"
          >
            Back to leagues
          </Link>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <p className="text-sm text-slate-500">Loading league...</p>
      </main>
    );
  }

  if (error || !league) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
            {error || "League not found."}
          </p>

          <Link
            to="/leagues"
            className="mt-4 inline-block text-sm font-medium text-slate-900 underline"
          >
            Back to leagues
          </Link>
        </div>
      </main>
    );
  }

  const currentMember = league.members.find(
    (member) => member.userId === user?.id,
  );

  const isAdmin = currentMember?.role === "ADMIN";

  async function createSeason(event: FormEvent) {
    event.preventDefault();

    if (!seasonName.trim()) {
      setSeasonMessage("Enter a season name.");
      return;
    }

    setSeasonMessage("");
    setCreatingSeason(true);

    try {
      await apiClient.post("/season", {
        leagueId,
        name: seasonName.trim(),
      });

      setSeasonName("");
      setSeasonMessage("Season created successfully.");
      await refreshLeague();
    } catch {
      setSeasonMessage("Unable to create the season.");
    } finally {
      setCreatingSeason(false);
    }
  }

  async function activateSeason(seasonId: string) {
    setActivatingSeasonId(seasonId);
    setSeasonMessage("");

    try {
      await apiClient.post(`/season/${seasonId}/activate`);
      await refreshLeague();
    } catch {
      setSeasonMessage("Unable to activate the season.");
    } finally {
      setActivatingSeasonId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to="/leagues"
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to leagues
        </Link>

        {/* League Header */}
        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">{league.name}</h1>

              <p className="mt-2 text-sm text-slate-500">Invite code</p>

              <p className="font-mono text-lg font-semibold tracking-wider">
                {league.inviteCode}
              </p>
            </div>

            <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {league.members.length}{" "}
              {league.members.length === 1 ? "member" : "members"}
            </span>
          </div>
        </div>

        {/* Members */}
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Members</h2>

          <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm">
            {league.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between border-b border-slate-100 px-5 py-4 last:border-b-0"
              >
                <div>
                  <p className="font-medium">{member.user.name}</p>

                  <p className="text-xs text-slate-500">
                    {member.role === "ADMIN" ? "Admin" : "Player"}
                  </p>
                </div>

                {member.role === "ADMIN" && (
                  <span className="text-xs font-medium text-slate-500">
                    Admin
                  </span>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Seasons */}
        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Seasons</h2>
          </div>

          {isAdmin && (
            <form
              onSubmit={createSeason}
              className="mt-3 rounded-2xl bg-white p-5 shadow-sm"
            >
              <h3 className="font-semibold">Create a season</h3>

              <p className="mt-1 text-sm text-slate-500">
                Create a season for this league.
              </p>

              <input
                value={seasonName}
                onChange={(event) => setSeasonName(event.target.value)}
                placeholder="Season name"
                className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
              />

              {seasonMessage && (
                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  {seasonMessage}
                </p>
              )}

              <button
                type="submit"
                disabled={creatingSeason}
                className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {creatingSeason ? "Creating..." : "Create season"}
              </button>
            </form>
          )}

          {league.seasons.length === 0 ? (
            <div className="mt-3 rounded-2xl bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">
                No season has been created yet.
              </p>
            </div>
          ) : (
            <div className="mt-3 grid gap-4">
              {league.seasons.map((season) => (
                <div
                  key={season.id}
                  className="rounded-2xl bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">{season.name}</h3>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${seasonStatusClasses(
                            season.status,
                          )}`}
                        >
                          {season.status}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        {season.gameweeks.length}{" "}
                        {season.gameweeks.length === 1
                          ? "gameweek"
                          : "gameweeks"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {isAdmin && season.status === "UPCOMING" && (
                        <button
                          type="button"
                          onClick={() => void activateSeason(season.id)}
                          disabled={activatingSeasonId === season.id}
                          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {activatingSeasonId === season.id
                            ? "Activating..."
                            : "Activate season"}
                        </button>
                      )}

                      <Link
                        to={`/leagues/${league.id}/seasons/${season.id}`}
                        className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
                      >
                        Open season
                      </Link>
                    </div>
                  </div>

                  {season.gameweeks.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {season.gameweeks.map((gameweek) => (
                        <Link
                          key={gameweek.id}
                          to={`/leagues/${league.id}/seasons/${season.id}/gameweeks/${gameweek.id}`}
                          className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 transition hover:border-slate-400 hover:bg-slate-50"
                        >
                          <div>
                            <p className="font-medium">
                              Gameweek {gameweek.number}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Deadline: {formatDeadline(gameweek.deadline)}
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses(
                              gameweek.status,
                            )}`}
                          >
                            {gameweek.status}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
