import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

type MockCall = {
  id: string;
  title: string;
  offer: string;
  duration: string;
  link: string;
  notes: string;
};

type Proof = {
  id: string;
  caption: string;
  src: string;
};

type Portfolio = {
  name: string;
  headline: string;
  location: string;
  bio: string;
  summary: string;
  resumeName: string;
  resumeLink: string;
  slug: string;
  published: boolean;
  calls: MockCall[];
  proof: Proof[];
};

const STORAGE_KEY = "closedeck.portfolio.v1";

const EMPTY: Portfolio = {
  name: "",
  headline: "",
  location: "",
  bio: "",
  summary: "",
  resumeName: "",
  resumeLink: "",
  slug: "",
  published: false,
  calls: [],
  proof: [],
};

const TABS = [
  { id: "profile", label: "Bio & summary" },
  { id: "calls", label: "Mock calls" },
  { id: "proof", label: "Proof images" },
  { id: "resume", label: "Resume" },
  { id: "publish", label: "Share link" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const INPUT =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20";
const LABEL = "block text-sm font-medium text-ink mb-1.5";
const CARD_PAD = "card p-5 sm:p-6";

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function slugify(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function TabButton(props: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={
        props.active
          ? "rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white"
          : "rounded-lg px-3.5 py-2 text-sm font-medium text-ink/70 hover:bg-slate-100"
      }
    >
      {props.label}
    </button>
  );
}

function Empty(props: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
      <p className="font-display text-base text-ink">{props.title}</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm text-ink/60">{props.body}</p>
    </div>
  );
}

export default function App() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [data, setData] = useState<Portfolio>(EMPTY);
  const [tab, setTab] = useState<TabId>("profile");
  const [saveState, setSaveState] = useState<"idle" | "saved" | "error">("idle");
  const [saveNote, setSaveNote] = useState("");
  const [formError, setFormError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [copied, setCopied] = useState("");
  const [draft, setDraft] = useState<MockCall>({
    id: "",
    title: "",
    offer: "",
    duration: "",
    link: "",
    notes: "",
  });
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) setData({ ...EMPTY, ...(JSON.parse(raw) as Portfolio) });
      } catch {
        setLoadError("Your browser blocked local storage, so nothing loaded. You can still edit this page, but changes will disappear when you close the tab.");
      }
      setLoading(false);
    }, 350);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setSaveState("saved");
      setSaveNote("");
    } catch {
      setSaveState("error");
      setSaveNote("Storage is full. Remove a proof image or two, then try again.");
    }
  }, [data, loading]);

  const set = <K extends keyof Portfolio>(key: K, value: Portfolio[K]) =>
    setData((prev) => ({ ...prev, [key]: value }));

  const shareSlug = data.slug || slugify(data.name) || "your-name";
  const shareLink = "closedeck.co/p/" + shareSlug;

  const checklist = useMemo(
    () => [
      { label: "Name and headline", done: data.name.trim().length > 1 && data.headline.trim().length > 3 },
      { label: "Short bio (60 characters or more)", done: data.bio.trim().length >= 60 },
      { label: "Performance summary", done: data.summary.trim().length >= 40 },
      { label: "At least one mock call", done: data.calls.length > 0 },
      { label: "At least one proof image", done: data.proof.length > 0 },
      { label: "Resume attached or linked", done: data.resumeName.length > 0 || data.resumeLink.trim().length > 0 },
    ],
    [data]
  );
  const doneCount = checklist.filter((c) => c.done).length;
  const readyToPublish = checklist[0].done && data.calls.length > 0;

  function addCall() {
    if (draft.title.trim().length < 2) {
      setFormError("Give the call a title so you can tell your recordings apart.");
      return;
    }
    if (draft.link.trim().length < 4) {
      setFormError("Paste the recording link (Loom, Drive, Vimeo, anything you host it on).");
      return;
    }
    setFormError("");
    setData((prev) => ({ ...prev, calls: [{ ...draft, id: uid() }, ...prev.calls] }));
    setDraft({ id: "", title: "", offer: "", duration: "", link: "", notes: "" });
  }

  function move(index: number, dir: -1 | 1) {
    setData((prev) => {
      const next = prev.calls.slice();
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const held = next[index];
      next[index] = next[target];
      next[target] = held;
      return { ...prev, calls: next };
    });
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploadError("");
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        setUploadError("Only image files work here. Screenshots of dashboards and payout pages are the ones people look at.");
        return;
      }
      if (file.size > 1200000) {
        setUploadError("Keep each image under 1.2 MB so your browser can hold it. A screenshot saved as JPG usually does the trick.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const src = String(reader.result || "");
        if (!src) return;
        setData((prev) => ({
          ...prev,
          proof: [...prev.proof, { id: uid(), caption: file.name.replace(/\.[^.]+$/, ""), src }],
        }));
      };
      reader.onerror = () => setUploadError("That file would not read. Try saving it again and re-adding it.");
      reader.readAsDataURL(file);
    });
    if (fileRef.current) fileRef.current.value = "";
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText("https://" + shareLink);
      setCopied("Copied. Paste it into your application or DM.");
    } catch {
      setCopied("Copy did not work in this browser. Select the link above and copy it by hand.");
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-slate-200" />
        <div className="mt-3 h-4 w-80 animate-pulse rounded bg-slate-200" />
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-40 animate-pulse rounded-xl bg-slate-100" />
        </div>
        <p className="mt-6 text-sm text-ink/60">Opening your workspace.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-600">My portfolio</p>
          <h1 className="font-display text-3xl text-ink sm:text-4xl">
            {data.name.trim() ? data.name : "Your closer workspace"}
          </h1>
          <p className="mt-1.5 max-w-xl text-sm text-ink/70">
            Load your mock calls, proof screenshots, and resume here. When it looks right, hand the link to a sales manager.
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-ink">{doneCount} of {checklist.length} pieces ready</p>
          <p className={saveState === "error" ? "text-xs text-red-600" : "text-xs text-ink/50"}>
            {saveState === "error" ? saveNote : "Kept in this browser"}
          </p>
        </div>
      </header>

      {loadError ? (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {loadError}
        </div>
      ) : null}

      <nav className="mt-7 flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5">
        {TABS.map((t) => (
          <TabButton key={t.id} active={tab === t.id} label={t.label} onClick={() => setTab(t.id)} />
        ))}
      </nav>

      <main className="mt-6 space-y-6">
        {tab === "profile" ? (
          <section className={CARD_PAD}>
            <h2 className="font-display text-xl text-ink">Who you are</h2>
            <p className="mt-1 text-sm text-ink/60">
              Two paragraphs is plenty. Hiring managers skim this, then jump to your calls.
            </p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <label className={LABEL}>Full name</label>
                <input className={INPUT} value={data.name} onChange={(e) => set("name", e.target.value)} placeholder="Marcus Reed" />
              </div>
              <div>
                <label className={LABEL}>Headline</label>
                <input className={INPUT} value={data.headline} onChange={(e) => set("headline", e.target.value)} placeholder="Remote closer, $8k coaching offers" />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Where you work from</label>
                <input className={INPUT} value={data.location} onChange={(e) => set("location", e.target.value)} placeholder="Austin, TX. Calls in CST and EST." />
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Bio</label>
                <textarea
                  className={INPUT}
                  rows={5}
                  value={data.bio}
                  onChange={(e) => set("bio", e.target.value)}
                  placeholder="Four years on the phones, the last two in high-ticket coaching. I run consult calls start to finish and handle my own follow-up."
                />
                <p className="mt-1 text-xs text-ink/50">{data.bio.trim().length} characters</p>
              </div>
              <div className="sm:col-span-2">
                <label className={LABEL}>Performance summary</label>
                <textarea
                  className={INPUT}
                  rows={4}
                  value={data.summary}
                  onChange={(e) => set("summary", e.target.value)}
                  placeholder="2024: 38% close rate on 410 booked calls, $612k collected. Best month was $91k on a $6k offer."
                />
                <p className="mt-1 text-xs text-ink/50">Real numbers beat adjectives. Add dates and offer prices.</p>
              </div>
            </div>
          </section>
        ) : null}

        {tab === "calls" ? (
          <div className="space-y-6">
            <section className={CARD_PAD}>
              <h2 className="font-display text-xl text-ink">Add a mock call</h2>
              <p className="mt-1 text-sm text-ink/60">Save as many as you want. Put your strongest one at the top.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL}>Call title</label>
                  <input className={INPUT} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Fitness coaching consult, price objection" />
                </div>
                <div>
                  <label className={LABEL}>Recording link</label>
                  <input className={INPUT} value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })} placeholder="https://loom.com/share/..." />
                </div>
                <div>
                  <label className={LABEL}>Offer and price</label>
                  <input className={INPUT} value={draft.offer} onChange={(e) => setDraft({ ...draft, offer: e.target.value })} placeholder="$5,000 group program" />
                </div>
                <div>
                  <label className={LABEL}>Length</label>
                  <input className={INPUT} value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} placeholder="41 min" />
                </div>
                <div className="sm:col-span-2">
                  <label className={LABEL}>What to listen for</label>
                  <textarea className={INPUT} rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Discovery runs to the 18 minute mark. Spouse objection comes up at 29 minutes." />
                </div>
              </div>
              {formError ? <p className="mt-3 text-sm text-red-600">{formError}</p> : null}
              <div className="mt-4">
                <button type="button" className="btn" onClick={addCall}>Save call</button>
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-display text-lg text-ink">Saved calls ({data.calls.length})</h3>
              {data.calls.length === 0 ? (
                <Empty title="No calls saved yet" body="Record a role play, drop the link in the form above, and it shows up here in your chosen order." />
              ) : (
                data.calls.map((call, i) => (
                  <article key={call.id} className="card p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-display text-base text-ink">{i + 1}. {call.title}</p>
                        <p className="mt-0.5 text-sm text-ink/60">
                          {call.offer ? call.offer : "Offer not listed"}
                          {call.duration ? " · " + call.duration : ""}
                        </p>
                        <a href={call.link} target="_blank" rel="noreferrer" className="mt-1 inline-block break-all text-sm text-brand-600 underline">
                          {call.link}
                        </a>
                        {call.notes ? <p className="mt-2 text-sm text-ink/75">{call.notes}</p> : null}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button type="button" className="btn-secondary" onClick={() => move(i, -1)}>Up</button>
                        <button type="button" className="btn-secondary" onClick={() => move(i, 1)}>Down</button>
                        <button
                          type="button"
                          className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                          onClick={() => set("calls", data.calls.filter((c) => c.id !== call.id))}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </section>
          </div>
        ) : null}

        {tab === "proof" ? (
          <div className="space-y-6">
            <section className={CARD_PAD}>
              <h2 className="font-display text-xl text-ink">Proof of performance</h2>
              <p className="mt-1 text-sm text-ink/60">
                Dashboard screenshots, commission statements, leaderboard placements. Blur out client names before you add them.
              </p>
              <div className="mt-4">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFiles(e.target.files)}
                  className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-2 text-sm text-ink/70"
                />
              </div>
              {uploadError ? <p className="mt-3 text-sm text-red-600">{uploadError}</p> : null}
              <p className="mt-3 text-xs text-ink/50">Images stay in this browser until you publish the portfolio.</p>
            </section>

            {data.proof.length === 0 ? (
              <Empty title="No screenshots yet" body="Most closers add three to six: pipeline view, cash collected, and one manager shout-out." />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.proof.map((p) => (
                  <figure key={p.id} className="card overflow-hidden">
                    <img src={p.src} alt={p.caption} className="h-44 w-full bg-slate-100 object-cover" />
                    <figcaption className="p-3">
                      <input
                        className={INPUT}
                        value={p.caption}
                        onChange={(e) =>
                          set("proof", data.proof.map((q) => (q.id === p.id ? { ...q, caption: e.target.value } : q)))
                        }
                        placeholder="Caption"
                      />
                      <button
                        type="button"
                        className="mt-2 text-sm font-medium text-red-600 hover:underline"
                        onClick={() => set("proof", data.proof.filter((q) => q.id !== p.id))}
                      >
                        Remove image
                      </button>
                    </figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {tab === "resume" ? (
          <section className={CARD_PAD}>
            <h2 className="font-display text-xl text-ink">Resume</h2>
            <p className="mt-1 text-sm text-ink/60">Attach the file for your own records, or point to a hosted PDF.</p>
            <div className="mt-5 space-y-4">
              <div>
                <label className={LABEL}>Attach a file</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => {
                    const f = e.target.files && e.target.files[0];
                    if (f) set("resumeName", f.name);
                  }}
                  className="block w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-2 text-sm text-ink/70"
                />
                {data.resumeName ? (
                  <p className="mt-2 text-sm text-ink/75">
                    Attached in this browser: <span className="font-medium text-ink">{data.resumeName}</span>{" "}
                    <button type="button" className="text-red-600 hover:underline" onClick={() => set("resumeName", "")}>
                      clear
                    </button>
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-ink/50">The file itself stays on your machine. We keep the name so you know which version you attached.</p>
                )}
              </div>
              <div>
                <label className={LABEL}>Or paste a link</label>
                <input className={INPUT} value={data.resumeLink} onChange={(e) => set("resumeLink", e.target.value)} placeholder="https://drive.google.com/file/..." />
              </div>
            </div>
          </section>
        ) : null}

        {tab === "publish" ? (
          <div className="space-y-6">
            <section className={CARD_PAD}>
              <h2 className="font-display text-xl text-ink">Your shareable link</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={LABEL}>Link ending</label>
                  <input
                    className={INPUT}
                    value={data.slug}
                    onChange={(e) => set("slug", slugify(e.target.value))}
                    placeholder={slugify(data.name) || "marcus-reed"}
                  />
                </div>
                <div className="flex items-end">
                  <p className="break-all rounded-lg bg-slate-100 px-3 py-2 text-sm text-ink">{shareLink}</p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={readyToPublish ? "btn" : "btn opacity-50"}
                  disabled={!readyToPublish}
                  onClick={() => set("published", true)}
                >
                  {data.published ? "Update published version" : "Publish portfolio"}
                </button>
                <button type="button" className="btn-secondary" onClick={copyLink}>Copy link</button>
                <a
                  className="btn-secondary"
                  href={"mailto:?subject=My%20CloseDeck%20portfolio&body=Here%20is%20my%20portfolio%3A%20https%3A%2F%2F" + shareSlug}
                >
                  Email it to a manager
                </a>
                {data.published ? (
                  <button type="button" className="text-sm font-medium text-ink/60 hover:underline" onClick={() => set("published", false)}>
                    Set back to private
                  </button>
                ) : null}
              </div>
              {!readyToPublish ? (
                <p className="mt-3 text-sm text-amber-700">Add your name, a headline, and one mock call first.</p>
              ) : null}
              {copied ? <p className="mt-3 text-sm text-ink/70">{copied}</p> : null}
              <p className="mt-4 text-sm text-ink/60">
                Status: {data.published ? "Published. Anyone with the link can view it." : "Private draft. Only you see this page."}
              </p>
            </section>

            <section className={CARD_PAD}>
              <h3 className="font-display text-lg text-ink">Before you send it</h3>
              <ul className="mt-3 space-y-2">
                {checklist.map((c) => (
                  <li key={c.label} className="flex items-center gap-3 text-sm">
                    <span
                      className={
                        c.done
                          ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white"
                          : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-300 text-xs font-bold text-slate-400"
                      }
                    >
                      {c.done ? "✓" : ""}
                    </span>
                    <span className={c.done ? "text-ink" : "text-ink/60"}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        ) : null}
      </main>

      <p className="mt-10 text-xs text-ink/50">
        Everything on this page lives in this browser only. Clearing your site data clears the draft, so keep your recording links somewhere else too.
      </p>
    </div>
  );
}

createRoot(document.getElementById("tibly-app-root")!).render(<App />);