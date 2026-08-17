import DashboardLayout from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Activity, ExternalLink, Play, Radio, RefreshCw, ShieldCheck, Trophy } from "lucide-react";
import { toast } from "sonner";

function statusTone(status: string) {
  if (status === "live") return "bg-red-500/15 text-red-300 border-red-400/30";
  if (status === "completed") return "bg-emerald-500/15 text-emerald-300 border-emerald-400/30";
  return "bg-amber-500/15 text-amber-200 border-amber-400/30";
}

export default function Home() {
  const utils = trpc.useUtils();
  const status = trpc.publisher.status.useQuery();
  const fixtures = trpc.publisher.fixtures.useQuery();
  const runs = trpc.publisher.runs.useQuery();
  const runNow = trpc.publisher.runNow.useMutation({
    onSuccess: result => {
      toast.success(`Publisher completed: ${result.postsCreated} created, ${result.postsUpdated} updated.`);
      void utils.publisher.fixtures.invalidate();
      void utils.publisher.runs.invalidate();
    },
    onError: error => toast.error(error.message),
  });

  const grouped = (fixtures.data ?? []).reduce<Record<string, typeof fixtures.data>>((groups, row) => {
    const key = row.tournament.name;
    (groups[key] ??= []).push(row);
    return groups;
  }, {});

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-[#07111f] text-slate-100 -m-4 p-4 md:p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <header className="relative overflow-hidden rounded-3xl border border-cyan-300/15 bg-gradient-to-br from-[#102a45] via-[#0c1a2e] to-[#07111f] p-6 shadow-2xl shadow-cyan-950/30 md:p-10">
            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
            <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
              <div>
                <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300"><Radio className="h-4 w-4" /> Watch Now Cricket</div>
                <h1 className="max-w-2xl text-3xl font-black tracking-tight md:text-5xl">Daily fixture control room</h1>
                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Collect CricketData fixtures, group them by tournament, and keep one Blogger match post synchronized for every fixture in Bangladesh time.</p>
              </div>
              <Button onClick={() => runNow.mutate()} disabled={runNow.isPending || !status.data?.authorized} className="gap-2 bg-cyan-300 text-slate-950 hover:bg-cyan-200"><Play className="h-4 w-4" /> {runNow.isPending ? "Publishing…" : "Run publisher now"}</Button>
            </div>
          </header>

          <section className="grid gap-4 md:grid-cols-3">
            <Card className="border-cyan-300/15 bg-[#0c1a2e] text-slate-100"><CardHeader className="pb-3"><CardTitle className="flex items-center justify-between text-sm font-medium text-slate-300">Blogger connection <ShieldCheck className="h-4 w-4 text-cyan-300" /></CardTitle></CardHeader><CardContent><div className="flex items-center gap-2 text-xl font-bold">{status.isLoading ? "Checking…" : status.data?.authorized ? "Authorized" : "Action needed"}<span className={`h-2.5 w-2.5 rounded-full ${status.data?.authorized ? "bg-emerald-400" : "bg-amber-400"}`} /></div><p className="mt-2 text-xs text-slate-400">{status.data?.authorized ? status.data.blogUrl : "Connect Google Blogger before the first run."}</p>{!status.data?.authorized && <Button asChild variant="outline" className="mt-4 border-cyan-300/30 bg-transparent text-cyan-200 hover:bg-cyan-300/10"><a href="/api/blogger/oauth/start">Connect Blogger <ExternalLink className="ml-2 h-3.5 w-3.5" /></a></Button>}</CardContent></Card>
            <Card className="border-cyan-300/15 bg-[#0c1a2e] text-slate-100"><CardHeader className="pb-3"><CardTitle className="flex items-center justify-between text-sm font-medium text-slate-300">Fixture feed <Activity className="h-4 w-4 text-lime-300" /></CardTitle></CardHeader><CardContent><div className="text-3xl font-black">{fixtures.data?.filter(row => Boolean(row.fixture.bloggerPostId)).length ?? 0}</div><p className="mt-2 text-xs text-slate-400">Published Blogger posts linked to retained fixtures.</p></CardContent></Card>
            <Card className="border-cyan-300/15 bg-[#0c1a2e] text-slate-100"><CardHeader className="pb-3"><CardTitle className="flex items-center justify-between text-sm font-medium text-slate-300">Last activity <RefreshCw className="h-4 w-4 text-violet-300" /></CardTitle></CardHeader><CardContent><div className="text-xl font-black">{runs.data?.[0]?.status ?? "No runs yet"}</div><p className="mt-2 text-xs text-slate-400">{runs.data?.[0]?.startedAt ? new Date(runs.data[0].startedAt).toLocaleString() : "Run the collector after authorization."}</p></CardContent></Card>
          </section>

          <section className="space-y-4">
            <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Schedule board</p><h2 className="mt-1 text-2xl font-bold">Tournament groups</h2></div><Badge variant="outline" className="border-slate-600 text-slate-300">GMT+6 · Bangladesh</Badge></div>
            {Object.keys(grouped).length === 0 ? <Card className="border-dashed border-slate-700 bg-transparent"><CardContent className="py-16 text-center text-slate-400">No fixtures are stored yet. Authorize Blogger, then run the publisher.</CardContent></Card> : Object.entries(grouped).map(([tournament, rows]) => <Card key={tournament} className="overflow-hidden border-cyan-300/15 bg-[#0c1a2e] text-slate-100"><CardHeader className="flex flex-row items-center justify-between border-b border-slate-700/60"><CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-300" />{tournament}</CardTitle><span className="text-xs text-slate-400">{rows?.length ?? 0} matches</span></CardHeader><CardContent className="p-0"><div className="divide-y divide-slate-700/50">{rows?.map(({ fixture }) => <div key={fixture.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_auto_auto] md:items-center"><div><div className="font-semibold">{fixture.teamOne} <span className="text-slate-500">vs</span> {fixture.teamTwo}</div><div className="mt-1 text-xs text-slate-400">{fixture.localDateGmt6} · {fixture.localTimeGmt6} GMT+6 · {fixture.venue}</div></div><Badge variant="outline" className={statusTone(fixture.status)}>{fixture.status}</Badge>{fixture.bloggerPostUrl ? <Button asChild size="sm" variant="ghost" className="justify-self-start text-cyan-200 hover:bg-cyan-300/10"><a href={fixture.bloggerPostUrl} target="_blank" rel="noreferrer">Post <ExternalLink className="ml-1 h-3 w-3" /></a></Button> : <span className="text-xs text-slate-500">Not published</span>}</div>)}</div></CardContent></Card>)}
          </section>

          <section><h2 className="mb-3 text-lg font-bold">Publisher run history</h2><Card className="border-cyan-300/15 bg-[#0c1a2e] text-slate-100"><CardContent className="p-0"><div className="divide-y divide-slate-700/50">{(runs.data ?? []).slice(0, 8).map(run => <div key={run.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm"><div><span className="font-medium capitalize">{run.trigger}</span><span className="ml-3 text-xs text-slate-400">{new Date(run.startedAt).toLocaleString()}</span></div><div className="flex items-center gap-3 text-xs text-slate-400"><span>{run.fixturesFetched} fixtures</span><span>{run.postsCreated} created</span><span>{run.postsUpdated} updated</span><span>API {run.apiStatusCode ?? "—"} · Blogger {run.bloggerStatusCode ?? "—"}</span>{run.postUrls && <span className="max-w-[22rem] truncate" title={run.postUrls}>{run.postUrls}</span>}<Badge variant="outline" className={statusTone(run.status)}>{run.status}</Badge></div></div>)}{(runs.data ?? []).length === 0 && <div className="px-5 py-8 text-center text-slate-400">No publisher runs yet.</div>}</div></CardContent></Card></section>
        </div>
      </div>
    </DashboardLayout>
  );
}
