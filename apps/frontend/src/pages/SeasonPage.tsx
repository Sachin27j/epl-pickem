import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";

import apiClient from "../api/client";
import { useAuth } from "../auth/use-auth";

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
  leagueId: string;
  gameweeks: Gameweek[];
}

interface LeagueMember {
  userId: string;
  role: "ADMIN" | "PLAYER";
}

interface League {
  id: string;
  members: LeagueMember[];
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  points: number;
  goalDifference: number;
}

interface PickUsagePlayer {
  userId: string;
  name: string;
}

interface PickUsageTeam {
  id: string;
  name: string;
  shortName: string;
}

interface PickUsageGameweek {
  id: string;
  number: number;
  status: "UPCOMING" | "OPEN" | "LOCKED" | "REVEALED";
}

interface PickUsagePick {
  userId: string;
  gameweekId: string;
  teamId: string;
}

interface PickUsage {
  players: PickUsagePlayer[];
  gameweeks: PickUsageGameweek[];
  teams: PickUsageTeam[];
  picks: PickUsagePick[];
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

export default function SeasonPage() {
  const { leagueId, seasonId } = useParams<{
    leagueId: string;
    seasonId: string;
  }>();

  const { user } = useAuth();

  const [season, setSeason] = useState<Season | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  const [pickUsage, setPickUsage] = useState<PickUsage | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [gameweekNumber, setGameweekNumber] = useState("");
  const [deadline, setDeadline] = useState("");
  const [creating, setCreating] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!leagueId || !seasonId) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [
          seasonResponse,
          leagueResponse,
          leaderboardResponse,
          pickUsageResponse,
        ] = await Promise.all([
          apiClient.get<Season>(`/season/${seasonId}`),
          apiClient.get<League>(`/league/${leagueId}`),
          apiClient.get<LeaderboardEntry[]>(
            `/season/${seasonId}/leaderboard`,
          ),
          apiClient.get<PickUsage>(`/season/${seasonId}/pick-usage`),
        ]);

        if (!cancelled) {
          setSeason(seasonResponse.data);
          setLeague(leagueResponse.data);
          setLeaderboard(leaderboardResponse.data);
          setPickUsage(pickUsageResponse.data);

          const players = pickUsageResponse.data.players;
          const currentPlayer = players.find(
            (player) => player.userId === user?.id,
          );

          setSelectedPlayerId(
            currentPlayer?.userId ?? players[0]?.userId ?? "",
          );
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load the season.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [leagueId, seasonId, user?.id]);

  async function refresh() {
    if (!seasonId) {
      return;
    }

    const [seasonResponse, leaderboardResponse, pickUsageResponse] =
      await Promise.all([
        apiClient.get<Season>(`/season/${seasonId}`),
        apiClient.get<LeaderboardEntry[]>(`/season/${seasonId}/leaderboard`),
        apiClient.get<PickUsage>(`/season/${seasonId}/pick-usage`),
      ]);

    setSeason(seasonResponse.data);
    setLeaderboard(leaderboardResponse.data);
    setPickUsage(pickUsageResponse.data);
  }

  async function createGameweek(event: FormEvent) {
    event.preventDefault();

    if (!seasonId) {
      return;
    }

    const number = Number(gameweekNumber);

    if (!Number.isInteger(number) || number < 1) {
      setMessage("Enter a valid gameweek number.");
      return;
    }

    if (!deadline) {
      setMessage("Select a deadline.");
      return;
    }

    const deadlineDate = new Date(deadline);

    if (deadlineDate <= new Date()) {
      setMessage("The deadline must be in the future.");
      return;
    }

    setCreating(true);
    setMessage("");

    try {
      await apiClient.post(`/season/${seasonId}/gameweek`, {
        number,
        deadline: deadlineDate.toISOString(),
      });

      setGameweekNumber("");
      setDeadline("");
      setMessage("Gameweek created successfully.");

      await refresh();
    } catch (err: any) {
      setMessage(
        err?.response?.data?.message || "Unable to create the gameweek.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function openGameweek(gameweekId: string) {
    if (!seasonId) {
      return;
    }

    setOpeningId(gameweekId);
    setMessage("");

    try {
      await apiClient.post(`/season/${seasonId}/gameweek/${gameweekId}/open`);

      setMessage("Gameweek opened successfully.");

      await refresh();
    } catch (err: any) {
      setMessage(
        err?.response?.data?.message || "Unable to open the gameweek.",
      );
    } finally {
      setOpeningId(null);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading season...</p>
      </main>
    );
  }

  if (error || !season || !league) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
            {error || "Season not found."}
          </p>

          <Link
            to={`/leagues/${leagueId}`}
            className="mt-4 inline-block text-sm font-medium underline"
          >
            ← Back to league
          </Link>
        </div>
      </main>
    );
  }

  const member = league.members.find((item) => item.userId === user?.id);
  const isAdmin = member?.role === "ADMIN";

  const selectedPlayer = pickUsage?.players.find(
    (player) => player.userId === selectedPlayerId,
  );

  const sortedTeams = [...(pickUsage?.teams ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  const sortedGameweeks = [...(pickUsage?.gameweeks ?? [])].sort(
    (a, b) => a.number - b.number,
  );

  function getPickForCell(teamId: string, gameweekId: string) {
    return pickUsage?.picks.some(
      (pick) =>
        pick.userId === selectedPlayerId &&
        pick.gameweekId === gameweekId &&
        pick.teamId === teamId,
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to={`/leagues/${leagueId}`}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to league
        </Link>

        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">{season.name}</h1>

              <p className="mt-2 text-sm text-slate-500">
                Manage your EPL Pick&apos;em season.
              </p>
            </div>

            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${seasonStatusClasses(
                season.status,
              )}`}
            >
              {season.status}
            </span>
          </div>
        </div>

        {message && (
          <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {message}
          </p>
        )}

        {isAdmin && season.status === "ACTIVE" && (
          <form
            onSubmit={createGameweek}
            className="mt-6 rounded-2xl bg-white p-5 shadow-sm"
          >
            <h2 className="font-semibold">Create gameweek</h2>

            <p className="mt-1 text-sm text-slate-500">
              Set the deadline. The gameweek will initially be upcoming.
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Gameweek number
                </label>

                <input
                  type="number"
                  min={1}
                  value={gameweekNumber}
                  onChange={(event) => setGameweekNumber(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                  placeholder="1"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">
                  Deadline
                </label>

                <input
                  type="datetime-local"
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={creating}
              className="mt-4 rounded-lg bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create gameweek"}
            </button>
          </form>
        )}

        {/* Season pick usage */}
        <section className="mt-6">
          <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
            <div>
              <h2 className="text-lg font-semibold">Season pick history</h2>

              <p className="mt-1 text-sm text-slate-500">
                See which teams each player has picked throughout the season.
              </p>
            </div>

            <div className="mt-5 max-w-sm">
              <label
                htmlFor="pick-history-player"
                className="block text-sm font-medium text-slate-700"
              >
                Select player
              </label>

              <select
                id="pick-history-player"
                value={selectedPlayerId}
                onChange={(event) => setSelectedPlayerId(event.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-900"
              >
                {pickUsage?.players.map((player) => (
                  <option key={player.userId} value={player.userId}>
                    {player.name}
                    {player.userId === user?.id ? " (You)" : ""}
                  </option>
                ))}
              </select>
            </div>

            {!pickUsage || pickUsage.players.length === 0 ? (
              <p className="mt-5 text-sm text-slate-500">
                No players found.
              </p>
            ) : sortedTeams.length === 0 ? (
              <p className="mt-5 text-sm text-slate-500">
                No teams found.
              </p>
            ) : (
              <>
                <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="font-bold text-green-600">✓</span>
                    Picked
                  </span>

                  <span className="flex items-center gap-1.5">
                    <span>—</span>
                    Not picked
                  </span>

                  <span className="flex items-center gap-1.5">
                    <span>·</span>
                    Not revealed
                  </span>
                </div>

                <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-max min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="sticky left-0 z-20 min-w-[150px] border-b border-r border-slate-200 bg-slate-50 px-4 py-3 text-left font-semibold text-slate-700">
                          Team
                        </th>

                        {sortedGameweeks.map((gameweek) => (
                          <th
                            key={gameweek.id}
                            className="min-w-[76px] border-b border-slate-200 px-3 py-3 text-center font-semibold text-slate-700"
                          >
                            GW{gameweek.number}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {sortedTeams.map((team) => (
                        <tr
                          key={team.id}
                          className="hover:bg-slate-50"
                        >
                          <td className="sticky left-0 z-10 border-b border-r border-slate-200 bg-white px-4 py-3 font-medium text-slate-800">
                            {team.name}
                          </td>

                          {sortedGameweeks.map((gameweek) => {
                            const isRevealed =
                              gameweek.status === "REVEALED";

                            const isPicked = isRevealed
                              ? getPickForCell(team.id, gameweek.id)
                              : false;

                            return (
                              <td
                                key={gameweek.id}
                                className="border-b border-slate-100 px-3 py-3 text-center"
                              >
                                {isRevealed ? (
                                  isPicked ? (
                                    <span
                                      className="font-bold text-green-600"
                                      title={`${selectedPlayer?.name} picked ${team.name} in GW${gameweek.number}`}
                                    >
                                      ✓
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )
                                ) : (
                                  <span
                                    className="text-slate-300"
                                    title="Picks are hidden until this gameweek is revealed"
                                  >
                                    ·
                                  </span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="mt-3 text-xs text-slate-400">
                  Scroll horizontally to view all gameweeks. Picks are shown
                  only after the corresponding gameweek is revealed.
                </p>
              </>
            )}
          </div>
        </section>

        <section className="mt-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Gameweeks</h2>
          </div>

          {season.gameweeks.length === 0 ? (
            <div className="mt-3 rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-sm text-slate-500">
                No gameweeks have been created yet.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {season.gameweeks.map((gameweek) => (
                <div
                  key={gameweek.id}
                  className="rounded-2xl bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold">
                          Gameweek {gameweek.number}
                        </h3>

                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${statusClasses(
                            gameweek.status,
                          )}`}
                        >
                          {gameweek.status}
                        </span>
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        Deadline: {formatDeadline(gameweek.deadline)}
                      </p>

                      {gameweek.status === "OPEN" && (
                        <p className="mt-1 text-xs text-slate-500">
                          Picks close at the deadline. Approved Late Passes can
                          be used for 24 hours afterward.
                        </p>
                      )}

                      {gameweek.status === "LOCKED" && (
                        <p className="mt-1 text-xs text-amber-600">
                          This gameweek is locked. Results can now be entered.
                        </p>
                      )}

                      {gameweek.status === "REVEALED" && (
                        <p className="mt-1 text-xs text-blue-600">
                          Results and scores have been revealed.
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {isAdmin && gameweek.status === "UPCOMING" && (
                        <button
                          type="button"
                          onClick={() => void openGameweek(gameweek.id)}
                          disabled={openingId === gameweek.id}
                          className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                        >
                          {openingId === gameweek.id
                            ? "Opening..."
                            : "Open gameweek"}
                        </button>
                      )}

                      <Link
                        to={`/leagues/${leagueId}/seasons/${season.id}/gameweeks/${gameweek.id}`}
                        className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6">
          <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Leaderboard</h2>

                <p className="mt-1 text-sm text-slate-500">
                  Season standings based on calculated points.
                </p>
              </div>
            </div>

            {leaderboard.length === 0 ? (
              <p className="mt-5 text-sm text-slate-500">No players yet.</p>
            ) : (
              <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
                {leaderboard.map((player) => (
                  <div
                    key={player.userId}
                    className="flex items-center justify-between border-b border-slate-100 px-4 py-4 last:border-b-0"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-sm font-bold">
                        {player.rank}
                      </div>

                      <div>
                        <p className="font-medium">{player.name}</p>

                        {player.userId === user?.id && (
                          <p className="text-xs text-slate-500">You</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">GD</p>
                        <p className="font-semibold">
                          {player.goalDifference > 0
                            ? `+${player.goalDifference}`
                            : player.goalDifference}
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-xs text-slate-500">Points</p>
                        <p className="text-lg font-bold">{player.points}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}