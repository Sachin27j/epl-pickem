import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import apiClient from "../api/client";
import { useAuth } from "../auth/use-auth";

interface Team {
  id: string;
  name: string;
  shortName: string;
  logoUrl?: string | null;
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

interface PickStatus {
  userId: string;
  name: string;
  hasPicked: boolean;
}

interface Pick {
  id: string;
  teamId: string;
  latePassUsed?: boolean;
  predictionBoostUsed?: boolean;
  predictedHomeGoals?: number | null;
  predictedAwayGoals?: number | null;
  team?: {
    id: string;
    name: string;
    shortName: string;
  };
}

interface LatePassRequest {
  id: string;
  userId: string;
  gameweekId: string;
  teamId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  reviewedAt?: string | null;
  user?: {
    id: string;
    name: string;
    email?: string;
  };
  team?: {
    id: string;
    name: string;
    shortName: string;
  };
}

interface GameweekResult {
  id: string;
  gameweekId: string;
  teamId: string;
  goalsFor: number;
  goalsAgainst: number;
  team: {
    id: string;
    name: string;
    shortName: string;
  };
}

function getTimeRemaining(deadline: string) {
  const diff = new Date(deadline).getTime() - Date.now();

  if (diff <= 0) {
    return "Deadline passed";
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 24) {
    const days = Math.floor(hours / 24);

    return `${days}d ${hours % 24}h remaining`;
  }

  return `${hours}h ${minutes}m remaining`;
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

export default function GameweekPage() {
  const { leagueId, seasonId, gameweekId } = useParams<{
    leagueId: string;
    seasonId: string;
    gameweekId: string;
  }>();

  const { user } = useAuth();

  const [season, setSeason] = useState<Season | null>(null);
  const [league, setLeague] = useState<League | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [pick, setPick] = useState<Pick | null>(null);
  const [pickStatuses, setPickStatuses] = useState<PickStatus[]>([]);
  const [latePass, setLatePass] = useState<LatePassRequest | null>(null);
  const [latePassRequests, setLatePassRequests] = useState<LatePassRequest[]>(
    [],
  );
  const [results, setResults] = useState<GameweekResult[]>([]);

  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [predictionBoostUsed, setPredictionBoostUsed] = useState(false);
  const [predictedHomeGoals, setPredictedHomeGoals] = useState("");
  const [predictedAwayGoals, setPredictedAwayGoals] = useState("");

  const [resultGoalsFor, setResultGoalsFor] = useState<Record<string, string>>(
    {},
  );
  const [resultGoalsAgainst, setResultGoalsAgainst] = useState<
    Record<string, string>
  >({});

  const [submitting, setSubmitting] = useState(false);
  const [requestingLatePass, setRequestingLatePass] = useState(false);
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(
    null,
  );
  const [savingResults, setSavingResults] = useState(false);
  const [calculatingScore, setCalculatingScore] = useState(false);
  const [revealing, setRevealing] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const gameweek = useMemo(
    () => season?.gameweeks.find((item) => item.id === gameweekId),
    [season, gameweekId],
  );

  const currentMember = league?.members.find(
    (member) => member.userId === user?.id,
  );

  const isAdmin = currentMember?.role === "ADMIN";

  async function load() {
    if (!seasonId || !gameweekId || !leagueId) {
      return;
    }

    const [
      seasonResponse,
      leagueResponse,
      teamsResponse,
      pickResponse,
      pickStatusesResponse,
      resultsResponse,
    ] = await Promise.all([
      apiClient.get<Season>(`/season/${seasonId}`),
      apiClient.get<League>(`/league/${leagueId}`),
      apiClient.get<Team[]>("/team"),
      apiClient
        .get<Pick | null>(`/pick/gameweek/${gameweekId}`)
        .catch(() => ({ data: null })),
      apiClient
        .get<PickStatus[]>(`/pick/gameweek/${gameweekId}/statuses`)
        .catch(() => ({ data: [] })),
      apiClient
        .get<GameweekResult[]>(
          `/season/${seasonId}/gameweek/${gameweekId}/results`,
        )
        .catch(() => ({ data: [] })),
    ]);

    setSeason(seasonResponse.data);
    setLeague(leagueResponse.data);
    setTeams(teamsResponse.data);
    setPick(pickResponse.data);
    setPickStatuses(pickStatusesResponse.data);
    setResults(resultsResponse.data);

    if (pickResponse.data) {
      setSelectedTeamId(pickResponse.data.teamId);
      setPredictionBoostUsed(pickResponse.data.predictionBoostUsed ?? false);
      setPredictedHomeGoals(
        pickResponse.data.predictedHomeGoals?.toString() ?? "",
      );
      setPredictedAwayGoals(
        pickResponse.data.predictedAwayGoals?.toString() ?? "",
      );
    }

    const currentMemberFromResponse = leagueResponse.data.members.find(
      (member) => member.userId === user?.id,
    );

    const isAdminFromResponse = currentMemberFromResponse?.role === "ADMIN";

    try {
      const response = await apiClient.get<LatePassRequest[]>(
        `/season/${seasonId}/gameweek/${gameweekId}/late-pass`,
      );

      if (isAdminFromResponse) {
        setLatePassRequests(response.data);
      } else {
        const mine = response.data.find(
          (request) => request.userId === user?.id,
        );

        console.log("LATE PASS DEBUG", {
          requests: response.data,
          userId: user?.id,
          mine,
        });

        setLatePass(mine ?? null);
      }
    } catch {
      if (isAdminFromResponse) {
        setLatePassRequests([]);
      } else {
        setLatePass(null);
      }
    }

    const nextGoalsFor: Record<string, string> = {};
    const nextGoalsAgainst: Record<string, string> = {};

    for (const result of resultsResponse.data) {
      nextGoalsFor[result.teamId] = result.goalsFor.toString();
      nextGoalsAgainst[result.teamId] = result.goalsAgainst.toString();
    }

    setResultGoalsFor(nextGoalsFor);
    setResultGoalsAgainst(nextGoalsAgainst);
  }

  useEffect(() => {
    let cancelled = false;

    async function initialLoad() {
      try {
        await load();
      } catch {
        if (!cancelled) {
          setError("Unable to load the gameweek.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void initialLoad();

    return () => {
      cancelled = true;
    };
  }, [seasonId, gameweekId, leagueId, user?.id]);

  async function submitPick() {
    if (!gameweekId || !selectedTeamId) {
      setError("Select a team first.");
      return;
    }

    if (
      predictionBoostUsed &&
      (predictedHomeGoals === "" || predictedAwayGoals === "")
    ) {
      setError("Enter both score predictions when using Prediction Boost.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const payload: Record<string, unknown> = {
        teamId: selectedTeamId,
      };

      if (!pick) {
        payload.gameweekId = gameweekId;
      }

      if (predictionBoostUsed) {
        payload.predictionBoostUsed = true;
        payload.predictedHomeGoals = Number(predictedHomeGoals);
        payload.predictedAwayGoals = Number(predictedAwayGoals);
      } else if (!pick) {
        payload.predictionBoostUsed = false;
      }

      if (pick) {
        await apiClient.patch(`/pick/${pick.id}`, payload);

        setMessage("Pick updated successfully.");
      } else {
        await apiClient.post("/pick", payload);

        setMessage("Pick submitted successfully.");
      }

      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to submit your pick.");
    } finally {
      setSubmitting(false);
    }
  }

  async function requestLatePass() {
    if (!seasonId || !gameweekId || !selectedTeamId) {
      setError(
        "Select the team you want to pick before requesting a Late Pass.",
      );
      return;
    }

    setRequestingLatePass(true);
    setError("");
    setMessage("");

    try {
      const response = await apiClient.post<LatePassRequest>(
        `/season/${seasonId}/gameweek/${gameweekId}/late-pass`,
        {
          teamId: selectedTeamId,
        },
      );

      setLatePass(response.data);

      setMessage("Late Pass request submitted for admin approval.");
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Unable to request a Late Pass.",
      );
    } finally {
      setRequestingLatePass(false);
    }
  }

  async function reviewLatePass(
    requestId: string,
    action: "approve" | "reject",
  ) {
    if (!seasonId || !gameweekId) {
      return;
    }

    setReviewingRequestId(requestId);
    setError("");
    setMessage("");

    try {
      await apiClient.post(
        `/season/${seasonId}/gameweek/${gameweekId}/late-pass/${requestId}/${action}`,
      );

      setMessage(
        action === "approve" ? "Late Pass approved." : "Late Pass rejected.",
      );

      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to review Late Pass.");
    } finally {
      setReviewingRequestId(null);
    }
  }

  async function saveResults() {
    if (!seasonId || !gameweekId) {
      return;
    }

    const entries = teams.filter(
      (team) =>
        resultGoalsFor[team.id] !== undefined &&
        resultGoalsAgainst[team.id] !== undefined &&
        resultGoalsFor[team.id] !== "" &&
        resultGoalsAgainst[team.id] !== "",
    );

    if (entries.length === 0) {
      setError("Enter at least one result.");
      return;
    }

    setSavingResults(true);
    setError("");
    setMessage("");

    try {
      for (const team of entries) {
        await apiClient.post(
          `/season/${seasonId}/gameweek/${gameweekId}/result`,
          {
            teamId: team.id,
            goalsFor: Number(resultGoalsFor[team.id]),
            goalsAgainst: Number(resultGoalsAgainst[team.id]),
          },
        );
      }

      setMessage("Results saved successfully.");

      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to save results.");
    } finally {
      setSavingResults(false);
    }
  }

  async function calculateScore() {
    if (!seasonId || !gameweekId) {
      return;
    }

    setCalculatingScore(true);
    setError("");
    setMessage("");

    try {
      await apiClient.post(`/season/${seasonId}/gameweek/${gameweekId}/score`);

      setMessage("Gameweek scores calculated successfully.");
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Unable to calculate scores.");
    } finally {
      setCalculatingScore(false);
    }
  }

  async function revealGameweek() {
    if (!seasonId || !gameweekId) {
      return;
    }

    setRevealing(true);
    setError("");
    setMessage("");

    try {
      await apiClient.post(`/season/${seasonId}/gameweek/${gameweekId}/reveal`);

      setMessage("Gameweek revealed successfully.");

      await load();
    } catch (err: any) {
      setError(
        err?.response?.data?.message || "Unable to reveal the gameweek.",
      );
    } finally {
      setRevealing(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading gameweek...</p>
      </main>
    );
  }

  if (error && (!season || !league || !gameweek)) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
            {error}
          </p>
        </div>
      </main>
    );
  }

  if (!season || !league || !gameweek) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-8">
        <div className="mx-auto max-w-5xl">
          <p className="rounded-lg bg-red-50 p-4 text-sm text-red-600">
            Gameweek not found.
          </p>
        </div>
      </main>
    );
  }

  const deadlinePassed = new Date(gameweek.deadline).getTime() <= Date.now();

  const latePassWindowOpen =
    deadlinePassed &&
    Date.now() < new Date(gameweek.deadline).getTime() + 24 * 60 * 60 * 1000 &&
    gameweek.status === "OPEN";

  const canPick =
    gameweek.status === "OPEN" &&
    (!deadlinePassed || latePass?.status === "APPROVED");
    
  const canRequestLatePass = latePassWindowOpen && !latePass;

  const selectedTeam = teams.find((team) => team.id === selectedTeamId);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-5xl">
        <Link
          to={`/leagues/${leagueId}/seasons/${seasonId}`}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to season
        </Link>

        <div className="mt-4 rounded-2xl bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                {season.name}
              </p>

              <h1 className="mt-1 text-2xl font-bold">
                Gameweek {gameweek.number}
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Deadline:{" "}
                {new Date(gameweek.deadline).toLocaleString([], {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>

              {gameweek.status === "OPEN" && (
                <p className="mt-1 text-sm font-medium text-slate-700">
                  {getTimeRemaining(gameweek.deadline)}
                </p>
              )}
            </div>

            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${statusClasses(
                gameweek.status,
              )}`}
            >
              {gameweek.status}
            </span>
          </div>
        </div>

        {message && (
          <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-700">
            {message}
          </p>
        )}

        {error && (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <section className="mt-6">
          <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-semibold">Picks</h2>

            <div className="mt-4 space-y-2">
              {pickStatuses.map((player) => (
                <div
                  key={player.userId}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3"
                >
                  <span className="text-sm font-medium">
                    {player.name}
                  </span>

                  <span
                    className={`text-sm ${
                      player.hasPicked
                        ? "text-green-600"
                        : "text-slate-400"
                    }`}
                  >
                    {player.hasPicked
                      ? "Has chosen their team ✓"
                      : "Has not chosen yet"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {!isAdmin && (
          <section className="mt-6">
            <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">Your pick</h2>

                  <p className="mt-1 text-sm text-slate-500">
                    Select one team for this gameweek.
                  </p>
                </div>

                {pick && (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
                    Submitted
                  </span>
                )}
              </div>

              {gameweek.status === "UPCOMING" && (
                <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                  This gameweek has not opened yet.
                </p>
              )}

              {gameweek.status === "LOCKED" && (
                <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
                  This gameweek is locked. No more picks can be submitted.
                </p>
              )}

              {gameweek.status === "REVEALED" && (
                <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                  This gameweek has been revealed.
                </p>
              )}

              {(canPick || canRequestLatePass) && (
                <>
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {teams.map((team) => {
                      const selected = selectedTeamId === team.id;

                      return (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => setSelectedTeamId(team.id)}
                          className={`rounded-xl border p-4 text-left transition ${
                            selected
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white hover:border-slate-400"
                          }`}
                        >
                          <p className="text-sm font-semibold">
                            {team.shortName}
                          </p>

                          <p
                            className={`mt-1 text-xs ${
                              selected ? "text-slate-300" : "text-slate-500"
                            }`}
                          >
                            {team.name}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={predictionBoostUsed}
                        onChange={(event) =>
                          setPredictionBoostUsed(event.target.checked)
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                      />

                      <div>
                        <p className="text-sm font-semibold">
                          Use Prediction Boost
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Correctly predict the selected team's score to double
                          your points.
                        </p>
                      </div>
                    </label>

                    {predictionBoostUsed && (
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            {selectedTeam?.shortName || "Selected team"} goals
                          </label>

                          <input
                            type="number"
                            min={0}
                            value={predictedHomeGoals}
                            onChange={(event) =>
                              setPredictedHomeGoals(event.target.value)
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-900"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-slate-600">
                            Opponent goals
                          </label>

                          <input
                            type="number"
                            min={0}
                            value={predictedAwayGoals}
                            onChange={(event) =>
                              setPredictedAwayGoals(event.target.value)
                            }
                            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-slate-900"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => void submitPick()}
                    disabled={!selectedTeamId || submitting}
                    className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {submitting
                      ? "Submitting..."
                      : pick
                        ? "Update pick"
                        : "Submit pick"}
                  </button>
                </>
              )}

              {deadlinePassed && gameweek.status === "OPEN" && !latePass && (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <h3 className="font-semibold text-amber-900">
                    Missed the deadline?
                  </h3>

                  <p className="mt-1 text-sm text-amber-800">
                    Select your team above, then request a Late Pass. An admin
                    must approve it before you can submit your pick.
                  </p>

                  {latePassWindowOpen && (
                    <button
                      type="button"
                      onClick={() => void requestLatePass()}
                      disabled={!selectedTeamId || requestingLatePass}
                      className="mt-3 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      {requestingLatePass
                        ? "Requesting..."
                        : "Request Late Pass"}
                    </button>
                  )}
                </div>
              )}

              {latePass && (
                <div className="mt-5 rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">Late Pass</h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Your request is{" "}
                        <span className="font-medium">
                          {latePass.status.toLowerCase()}
                        </span>
                        .
                      </p>

                      {latePass.team && (
                        <p className="mt-1 text-sm text-slate-600">
                          Requested pick:{" "}
                          <span className="font-semibold">
                            {latePass.team.name}
                          </span>
                        </p>
                      )}
                    </div>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                      {latePass.status}
                    </span>
                  </div>

                  {latePass.status === "PENDING" && (
                    <p className="mt-3 text-sm text-amber-700">
                      Waiting for a league admin to review your request.
                    </p>
                  )}

                  {latePass.status === "APPROVED" && (
                    <p className="mt-3 text-sm text-green-700">
                      Approved. You can submit your pick during the Late Pass
                      window.
                    </p>
                  )}

                  {latePass.status === "REJECTED" && (
                    <p className="mt-3 text-sm text-red-600">
                      Your Late Pass request was rejected.
                    </p>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {isAdmin && (
          <>
            <section className="mt-6">
              <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-semibold">Late Pass requests</h2>

                <p className="mt-1 text-sm text-slate-500">
                  Review requests from league members.
                </p>

                {latePassRequests.length === 0 ? (
                  <p className="mt-5 text-sm text-slate-500">
                    No Late Pass requests for this gameweek.
                  </p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {latePassRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="font-medium">
                            {request.user?.name ||
                              request.user?.email ||
                              request.userId}
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            Pick:{" "}
                            <span className="font-semibold">
                              {request.team?.name || "Unknown team"}
                            </span>
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Requested{" "}
                            {new Date(request.createdAt).toLocaleString()}
                          </p>

                          <span className="mt-2 inline-block rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                            {request.status}
                          </span>
                        </div>

                        {request.status === "PENDING" && (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                void reviewLatePass(request.id, "approve")
                              }
                              disabled={reviewingRequestId === request.id}
                              className="rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                            >
                              Approve
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                void reviewLatePass(request.id, "reject")
                              }
                              disabled={reviewingRequestId === request.id}
                              className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className="mt-6">
              <div className="rounded-2xl bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold">Gameweek results</h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Enter results for teams that were selected this gameweek.
                    </p>
                  </div>

                  <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                    {results.length} result
                    {results.length === 1 ? "" : "s"} entered
                  </span>
                </div>

                {gameweek.status === "LOCKED" ? (
                  <>
                    <div className="mt-5 space-y-3">
                      {teams.map((team) => (
                        <div
                          key={team.id}
                          className="grid grid-cols-[1fr_80px_80px] items-center gap-3 rounded-xl border border-slate-200 p-3"
                        >
                          <div>
                            <p className="font-medium">{team.name}</p>

                            <p className="text-xs text-slate-500">
                              {team.shortName}
                            </p>
                          </div>

                          <input
                            type="number"
                            min={0}
                            value={resultGoalsFor[team.id] ?? ""}
                            onChange={(event) =>
                              setResultGoalsFor((current) => ({
                                ...current,
                                [team.id]: event.target.value,
                              }))
                            }
                            placeholder="GF"
                            className="rounded-lg border border-slate-300 px-3 py-2 text-center outline-none focus:border-slate-900"
                          />

                          <input
                            type="number"
                            min={0}
                            value={resultGoalsAgainst[team.id] ?? ""}
                            onChange={(event) =>
                              setResultGoalsAgainst((current) => ({
                                ...current,
                                [team.id]: event.target.value,
                              }))
                            }
                            placeholder="GA"
                            className="rounded-lg border border-slate-300 px-3 py-2 text-center outline-none focus:border-slate-900"
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => void saveResults()}
                      disabled={savingResults}
                      className="mt-5 w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
                    >
                      {savingResults ? "Saving results..." : "Save results"}
                    </button>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => void calculateScore()}
                        disabled={calculatingScore}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium hover:bg-slate-50 disabled:opacity-60"
                      >
                        {calculatingScore
                          ? "Calculating..."
                          : "Calculate scores"}
                      </button>

                      <button
                        type="button"
                        onClick={() => void revealGameweek()}
                        disabled={revealing || results.length === 0}
                        className="rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
                      >
                        {revealing ? "Revealing..." : "Reveal gameweek"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                    Results can be entered once the gameweek is locked.
                  </div>
                )}

                {results.length > 0 && (
                  <div className="mt-5">
                    <h3 className="text-sm font-semibold">Saved results</h3>

                    <div className="mt-3 space-y-2">
                      {results.map((result) => (
                        <div
                          key={result.id}
                          className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                        >
                          <span className="font-medium">
                            {result.team.name}
                          </span>

                          <span className="font-mono font-semibold">
                            {result.goalsFor} - {result.goalsAgainst}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </>
        )}

        {gameweek.status === "REVEALED" && (
          <section className="mt-6">
            <div className="rounded-2xl bg-blue-50 p-5">
              <h2 className="font-semibold text-blue-900">Gameweek revealed</h2>

              <p className="mt-1 text-sm text-blue-700">
                Scores and results for this gameweek are now final.
              </p>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
