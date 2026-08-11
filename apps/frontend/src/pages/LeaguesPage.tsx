import { useEffect, useState, type FormEvent } from "react";

import apiClient from "../api/client";

import { Link } from "react-router-dom";

interface League {
  id: string;
  name: string;
  inviteCode: string;
  createdAt: string;
}

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [leagueName, setLeagueName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchLeagues() {
      try {
        const response = await apiClient.get<League[]>("/league");

        if (!cancelled) {
          setLeagues(response.data);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load your leagues.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchLeagues();

    return () => {
      cancelled = true;
    };
  }, []);

  async function refreshLeagues() {
    const response = await apiClient.get<League[]>("/league");

    setLeagues(response.data);
  }

  async function createLeague(event: FormEvent) {
    event.preventDefault();

    if (!leagueName.trim()) {
      setError("Enter a league name.");
      return;
    }

    setError("");
    setMessage("");
    setCreating(true);

    try {
      await apiClient.post("/league", {
        name: leagueName.trim(),
      });

      setLeagueName("");
      setMessage("League created successfully.");
      await refreshLeagues();
    } catch {
      setError("Unable to create the league.");
    } finally {
      setCreating(false);
    }
  }

  async function joinLeague(event: FormEvent) {
    event.preventDefault();

    if (!inviteCode.trim()) {
      setError("Enter an invite code.");
      return;
    }

    setError("");
    setMessage("");
    setJoining(true);

    try {
      await apiClient.post("/league/join", {
        inviteCode: inviteCode.trim().toUpperCase(),
      });

      setInviteCode("");
      setMessage("You joined the league successfully.");
      await refreshLeagues();
    } catch {
      setError("Unable to join the league. Check the invite code.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-2xl font-bold">My Leagues</h1>

        <p className="mt-1 text-sm text-slate-500">
          Create a league or join one using an invite code.
        </p>

        {(error || message) && (
          <div className="mt-4">
            {error && (
              <p className="rounded-lg bg-red-50 p-3 text-sm text-red-600">
                {error}
              </p>
            )}

            {message && (
              <p className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
                {message}
              </p>
            )}
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <form
            onSubmit={createLeague}
            className="rounded-2xl bg-white p-5 shadow-sm"
          >
            <h2 className="text-lg font-semibold">Create a league</h2>

            <p className="mt-1 text-sm text-slate-500">
              Start your own private EPL Pick'em league.
            </p>

            <input
              value={leagueName}
              onChange={(event) => setLeagueName(event.target.value)}
              placeholder="League name"
              className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-slate-900"
            />

            <button
              type="submit"
              disabled={creating}
              className="mt-3 w-full rounded-lg bg-slate-900 px-4 py-3 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {creating ? "Creating..." : "Create league"}
            </button>
          </form>

          <form
            onSubmit={joinLeague}
            className="rounded-2xl bg-white p-5 shadow-sm"
          >
            <h2 className="text-lg font-semibold">Join a league</h2>

            <p className="mt-1 text-sm text-slate-500">
              Enter the invite code shared by the league admin.
            </p>

            <input
              value={inviteCode}
              onChange={(event) => setInviteCode(event.target.value)}
              placeholder="Invite code"
              maxLength={8}
              className="mt-4 w-full rounded-lg border border-slate-300 px-4 py-3 uppercase outline-none focus:border-slate-900"
            />

            <button
              type="submit"
              disabled={joining}
              className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 font-medium hover:bg-slate-50 disabled:opacity-60"
            >
              {joining ? "Joining..." : "Join league"}
            </button>
          </form>
        </div>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">Your leagues</h2>

          {loading ? (
            <p className="mt-4 text-sm text-slate-500">Loading leagues...</p>
          ) : leagues.length === 0 ? (
            <div className="mt-4 rounded-2xl bg-white p-6 text-center shadow-sm">
              <p className="text-sm text-slate-500">
                You haven't joined any leagues yet.
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3">
              {leagues.map((league) => (
                <div
                  key={league.id}
                  className="rounded-2xl bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="font-semibold">{league.name}</h3>

                      <p className="mt-1 text-sm text-slate-500">
                        Invite code:{" "}
                        <span className="font-mono font-medium text-slate-900">
                          {league.inviteCode}
                        </span>
                      </p>
                    </div>

                    <Link
                      to={`/leagues/${league.id}`}
                      className="rounded-lg bg-slate-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-slate-800"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
