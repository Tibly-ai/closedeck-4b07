import { jsx, jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
const STORAGE_KEY = "closedeck.portfolio.v1";
const EMPTY = {
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
  proof: []
};
const TABS = [
  { id: "profile", label: "Bio & summary" },
  { id: "calls", label: "Mock calls" },
  { id: "proof", label: "Proof images" },
  { id: "resume", label: "Resume" },
  { id: "publish", label: "Share link" }
];
const INPUT = "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20";
const LABEL = "block text-sm font-medium text-ink mb-1.5";
const CARD_PAD = "card p-5 sm:p-6";
function uid() {
  return Math.random().toString(36).slice(2, 10);
}
function slugify(raw) {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}
function TabButton(props) {
  return /* @__PURE__ */ jsx(
    "button",
    {
      type: "button",
      onClick: props.onClick,
      className: props.active ? "rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white" : "rounded-lg px-3.5 py-2 text-sm font-medium text-ink/70 hover:bg-slate-100",
      children: props.label
    }
  );
}
function Empty(props) {
  return /* @__PURE__ */ jsxs("div", { className: "rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center", children: [
    /* @__PURE__ */ jsx("p", { className: "font-display text-base text-ink", children: props.title }),
    /* @__PURE__ */ jsx("p", { className: "mx-auto mt-1.5 max-w-md text-sm text-ink/60", children: props.body })
  ] });
}
function App() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [data, setData] = useState(EMPTY);
  const [tab, setTab] = useState("profile");
  const [saveState, setSaveState] = useState("idle");
  const [saveNote, setSaveNote] = useState("");
  const [formError, setFormError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [copied, setCopied] = useState("");
  const [draft, setDraft] = useState({
    id: "",
    title: "",
    offer: "",
    duration: "",
    link: "",
    notes: ""
  });
  const fileRef = useRef(null);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) setData({ ...EMPTY, ...JSON.parse(raw) });
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
  const set = (key, value) => setData((prev) => ({ ...prev, [key]: value }));
  const shareSlug = data.slug || slugify(data.name) || "your-name";
  const shareLink = "closedeck.co/p/" + shareSlug;
  const checklist = useMemo(
    () => [
      { label: "Name and headline", done: data.name.trim().length > 1 && data.headline.trim().length > 3 },
      { label: "Short bio (60 characters or more)", done: data.bio.trim().length >= 60 },
      { label: "Performance summary", done: data.summary.trim().length >= 40 },
      { label: "At least one mock call", done: data.calls.length > 0 },
      { label: "At least one proof image", done: data.proof.length > 0 },
      { label: "Resume attached or linked", done: data.resumeName.length > 0 || data.resumeLink.trim().length > 0 }
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
  function move(index, dir) {
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
  function handleFiles(files) {
    if (!files || files.length === 0) return;
    setUploadError("");
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        setUploadError("Only image files work here. Screenshots of dashboards and payout pages are the ones people look at.");
        return;
      }
      if (file.size > 12e5) {
        setUploadError("Keep each image under 1.2 MB so your browser can hold it. A screenshot saved as JPG usually does the trick.");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const src = String(reader.result || "");
        if (!src) return;
        setData((prev) => ({
          ...prev,
          proof: [...prev.proof, { id: uid(), caption: file.name.replace(/\.[^.]+$/, ""), src }]
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
    return /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-5xl px-4 py-10", children: [
      /* @__PURE__ */ jsx("div", { className: "h-8 w-56 animate-pulse rounded-lg bg-slate-200" }),
      /* @__PURE__ */ jsx("div", { className: "mt-3 h-4 w-80 animate-pulse rounded bg-slate-200" }),
      /* @__PURE__ */ jsxs("div", { className: "mt-8 grid gap-4 sm:grid-cols-2", children: [
        /* @__PURE__ */ jsx("div", { className: "h-40 animate-pulse rounded-xl bg-slate-100" }),
        /* @__PURE__ */ jsx("div", { className: "h-40 animate-pulse rounded-xl bg-slate-100" })
      ] }),
      /* @__PURE__ */ jsx("p", { className: "mt-6 text-sm text-ink/60", children: "Opening your workspace." })
    ] });
  }
  return /* @__PURE__ */ jsxs("div", { className: "mx-auto max-w-5xl px-4 py-10", children: [
    /* @__PURE__ */ jsxs("header", { className: "flex flex-wrap items-end justify-between gap-4", children: [
      /* @__PURE__ */ jsxs("div", { children: [
        /* @__PURE__ */ jsx("p", { className: "text-xs font-semibold uppercase tracking-widest text-brand-600", children: "My portfolio" }),
        /* @__PURE__ */ jsx("h1", { className: "font-display text-3xl text-ink sm:text-4xl", children: data.name.trim() ? data.name : "Your closer workspace" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1.5 max-w-xl text-sm text-ink/70", children: "Load your mock calls, proof screenshots, and resume here. When it looks right, hand the link to a sales manager." })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "text-right", children: [
        /* @__PURE__ */ jsxs("p", { className: "text-sm font-medium text-ink", children: [
          doneCount,
          " of ",
          checklist.length,
          " pieces ready"
        ] }),
        /* @__PURE__ */ jsx("p", { className: saveState === "error" ? "text-xs text-red-600" : "text-xs text-ink/50", children: saveState === "error" ? saveNote : "Kept in this browser" })
      ] })
    ] }),
    loadError ? /* @__PURE__ */ jsx("div", { className: "mt-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900", children: loadError }) : null,
    /* @__PURE__ */ jsx("nav", { className: "mt-7 flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5", children: TABS.map((t) => /* @__PURE__ */ jsx(TabButton, { active: tab === t.id, label: t.label, onClick: () => setTab(t.id) }, t.id)) }),
    /* @__PURE__ */ jsxs("main", { className: "mt-6 space-y-6", children: [
      tab === "profile" ? /* @__PURE__ */ jsxs("section", { className: CARD_PAD, children: [
        /* @__PURE__ */ jsx("h2", { className: "font-display text-xl text-ink", children: "Who you are" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-ink/60", children: "Two paragraphs is plenty. Hiring managers skim this, then jump to your calls." }),
        /* @__PURE__ */ jsxs("div", { className: "mt-5 grid gap-4 sm:grid-cols-2", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: LABEL, children: "Full name" }),
            /* @__PURE__ */ jsx("input", { className: INPUT, value: data.name, onChange: (e) => set("name", e.target.value), placeholder: "Marcus Reed" })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: LABEL, children: "Headline" }),
            /* @__PURE__ */ jsx("input", { className: INPUT, value: data.headline, onChange: (e) => set("headline", e.target.value), placeholder: "Remote closer, $8k coaching offers" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "sm:col-span-2", children: [
            /* @__PURE__ */ jsx("label", { className: LABEL, children: "Where you work from" }),
            /* @__PURE__ */ jsx("input", { className: INPUT, value: data.location, onChange: (e) => set("location", e.target.value), placeholder: "Austin, TX. Calls in CST and EST." })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "sm:col-span-2", children: [
            /* @__PURE__ */ jsx("label", { className: LABEL, children: "Bio" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                className: INPUT,
                rows: 5,
                value: data.bio,
                onChange: (e) => set("bio", e.target.value),
                placeholder: "Four years on the phones, the last two in high-ticket coaching. I run consult calls start to finish and handle my own follow-up."
              }
            ),
            /* @__PURE__ */ jsxs("p", { className: "mt-1 text-xs text-ink/50", children: [
              data.bio.trim().length,
              " characters"
            ] })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "sm:col-span-2", children: [
            /* @__PURE__ */ jsx("label", { className: LABEL, children: "Performance summary" }),
            /* @__PURE__ */ jsx(
              "textarea",
              {
                className: INPUT,
                rows: 4,
                value: data.summary,
                onChange: (e) => set("summary", e.target.value),
                placeholder: "2024: 38% close rate on 410 booked calls, $612k collected. Best month was $91k on a $6k offer."
              }
            ),
            /* @__PURE__ */ jsx("p", { className: "mt-1 text-xs text-ink/50", children: "Real numbers beat adjectives. Add dates and offer prices." })
          ] })
        ] })
      ] }) : null,
      tab === "calls" ? /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
        /* @__PURE__ */ jsxs("section", { className: CARD_PAD, children: [
          /* @__PURE__ */ jsx("h2", { className: "font-display text-xl text-ink", children: "Add a mock call" }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-ink/60", children: "Save as many as you want. Put your strongest one at the top." }),
          /* @__PURE__ */ jsxs("div", { className: "mt-5 grid gap-4 sm:grid-cols-2", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { className: LABEL, children: "Call title" }),
              /* @__PURE__ */ jsx("input", { className: INPUT, value: draft.title, onChange: (e) => setDraft({ ...draft, title: e.target.value }), placeholder: "Fitness coaching consult, price objection" })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { className: LABEL, children: "Recording link" }),
              /* @__PURE__ */ jsx("input", { className: INPUT, value: draft.link, onChange: (e) => setDraft({ ...draft, link: e.target.value }), placeholder: "https://loom.com/share/..." })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { className: LABEL, children: "Offer and price" }),
              /* @__PURE__ */ jsx("input", { className: INPUT, value: draft.offer, onChange: (e) => setDraft({ ...draft, offer: e.target.value }), placeholder: "$5,000 group program" })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { className: LABEL, children: "Length" }),
              /* @__PURE__ */ jsx("input", { className: INPUT, value: draft.duration, onChange: (e) => setDraft({ ...draft, duration: e.target.value }), placeholder: "41 min" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "sm:col-span-2", children: [
              /* @__PURE__ */ jsx("label", { className: LABEL, children: "What to listen for" }),
              /* @__PURE__ */ jsx("textarea", { className: INPUT, rows: 3, value: draft.notes, onChange: (e) => setDraft({ ...draft, notes: e.target.value }), placeholder: "Discovery runs to the 18 minute mark. Spouse objection comes up at 29 minutes." })
            ] })
          ] }),
          formError ? /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm text-red-600", children: formError }) : null,
          /* @__PURE__ */ jsx("div", { className: "mt-4", children: /* @__PURE__ */ jsx("button", { type: "button", className: "btn", onClick: addCall, children: "Save call" }) })
        ] }),
        /* @__PURE__ */ jsxs("section", { className: "space-y-3", children: [
          /* @__PURE__ */ jsxs("h3", { className: "font-display text-lg text-ink", children: [
            "Saved calls (",
            data.calls.length,
            ")"
          ] }),
          data.calls.length === 0 ? /* @__PURE__ */ jsx(Empty, { title: "No calls saved yet", body: "Record a role play, drop the link in the form above, and it shows up here in your chosen order." }) : data.calls.map((call, i) => /* @__PURE__ */ jsx("article", { className: "card p-5", children: /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [
            /* @__PURE__ */ jsxs("div", { className: "min-w-0", children: [
              /* @__PURE__ */ jsxs("p", { className: "font-display text-base text-ink", children: [
                i + 1,
                ". ",
                call.title
              ] }),
              /* @__PURE__ */ jsxs("p", { className: "mt-0.5 text-sm text-ink/60", children: [
                call.offer ? call.offer : "Offer not listed",
                call.duration ? " \xB7 " + call.duration : ""
              ] }),
              /* @__PURE__ */ jsx("a", { href: call.link, target: "_blank", rel: "noreferrer", className: "mt-1 inline-block break-all text-sm text-brand-600 underline", children: call.link }),
              call.notes ? /* @__PURE__ */ jsx("p", { className: "mt-2 text-sm text-ink/75", children: call.notes }) : null
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "flex shrink-0 gap-2", children: [
              /* @__PURE__ */ jsx("button", { type: "button", className: "btn-secondary", onClick: () => move(i, -1), children: "Up" }),
              /* @__PURE__ */ jsx("button", { type: "button", className: "btn-secondary", onClick: () => move(i, 1), children: "Down" }),
              /* @__PURE__ */ jsx(
                "button",
                {
                  type: "button",
                  className: "rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50",
                  onClick: () => set("calls", data.calls.filter((c) => c.id !== call.id)),
                  children: "Remove"
                }
              )
            ] })
          ] }) }, call.id))
        ] })
      ] }) : null,
      tab === "proof" ? /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
        /* @__PURE__ */ jsxs("section", { className: CARD_PAD, children: [
          /* @__PURE__ */ jsx("h2", { className: "font-display text-xl text-ink", children: "Proof of performance" }),
          /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-ink/60", children: "Dashboard screenshots, commission statements, leaderboard placements. Blur out client names before you add them." }),
          /* @__PURE__ */ jsx("div", { className: "mt-4", children: /* @__PURE__ */ jsx(
            "input",
            {
              ref: fileRef,
              type: "file",
              accept: "image/*",
              multiple: true,
              onChange: (e) => handleFiles(e.target.files),
              className: "block w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-2 text-sm text-ink/70"
            }
          ) }),
          uploadError ? /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm text-red-600", children: uploadError }) : null,
          /* @__PURE__ */ jsx("p", { className: "mt-3 text-xs text-ink/50", children: "Images stay in this browser until you publish the portfolio." })
        ] }),
        data.proof.length === 0 ? /* @__PURE__ */ jsx(Empty, { title: "No screenshots yet", body: "Most closers add three to six: pipeline view, cash collected, and one manager shout-out." }) : /* @__PURE__ */ jsx("div", { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3", children: data.proof.map((p) => /* @__PURE__ */ jsxs("figure", { className: "card overflow-hidden", children: [
          /* @__PURE__ */ jsx("img", { src: p.src, alt: p.caption, className: "h-44 w-full bg-slate-100 object-cover" }),
          /* @__PURE__ */ jsxs("figcaption", { className: "p-3", children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                className: INPUT,
                value: p.caption,
                onChange: (e) => set("proof", data.proof.map((q) => q.id === p.id ? { ...q, caption: e.target.value } : q)),
                placeholder: "Caption"
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: "mt-2 text-sm font-medium text-red-600 hover:underline",
                onClick: () => set("proof", data.proof.filter((q) => q.id !== p.id)),
                children: "Remove image"
              }
            )
          ] })
        ] }, p.id)) })
      ] }) : null,
      tab === "resume" ? /* @__PURE__ */ jsxs("section", { className: CARD_PAD, children: [
        /* @__PURE__ */ jsx("h2", { className: "font-display text-xl text-ink", children: "Resume" }),
        /* @__PURE__ */ jsx("p", { className: "mt-1 text-sm text-ink/60", children: "Attach the file for your own records, or point to a hosted PDF." }),
        /* @__PURE__ */ jsxs("div", { className: "mt-5 space-y-4", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: LABEL, children: "Attach a file" }),
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "file",
                accept: ".pdf,.doc,.docx",
                onChange: (e) => {
                  const f = e.target.files && e.target.files[0];
                  if (f) set("resumeName", f.name);
                },
                className: "block w-full cursor-pointer rounded-lg border border-slate-300 bg-white p-2 text-sm text-ink/70"
              }
            ),
            data.resumeName ? /* @__PURE__ */ jsxs("p", { className: "mt-2 text-sm text-ink/75", children: [
              "Attached in this browser: ",
              /* @__PURE__ */ jsx("span", { className: "font-medium text-ink", children: data.resumeName }),
              " ",
              /* @__PURE__ */ jsx("button", { type: "button", className: "text-red-600 hover:underline", onClick: () => set("resumeName", ""), children: "clear" })
            ] }) : /* @__PURE__ */ jsx("p", { className: "mt-2 text-xs text-ink/50", children: "The file itself stays on your machine. We keep the name so you know which version you attached." })
          ] }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("label", { className: LABEL, children: "Or paste a link" }),
            /* @__PURE__ */ jsx("input", { className: INPUT, value: data.resumeLink, onChange: (e) => set("resumeLink", e.target.value), placeholder: "https://drive.google.com/file/..." })
          ] })
        ] })
      ] }) : null,
      tab === "publish" ? /* @__PURE__ */ jsxs("div", { className: "space-y-6", children: [
        /* @__PURE__ */ jsxs("section", { className: CARD_PAD, children: [
          /* @__PURE__ */ jsx("h2", { className: "font-display text-xl text-ink", children: "Your shareable link" }),
          /* @__PURE__ */ jsxs("div", { className: "mt-4 grid gap-4 sm:grid-cols-2", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { className: LABEL, children: "Link ending" }),
              /* @__PURE__ */ jsx(
                "input",
                {
                  className: INPUT,
                  value: data.slug,
                  onChange: (e) => set("slug", slugify(e.target.value)),
                  placeholder: slugify(data.name) || "marcus-reed"
                }
              )
            ] }),
            /* @__PURE__ */ jsx("div", { className: "flex items-end", children: /* @__PURE__ */ jsx("p", { className: "break-all rounded-lg bg-slate-100 px-3 py-2 text-sm text-ink", children: shareLink }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "mt-5 flex flex-wrap items-center gap-3", children: [
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                className: readyToPublish ? "btn" : "btn opacity-50",
                disabled: !readyToPublish,
                onClick: () => set("published", true),
                children: data.published ? "Update published version" : "Publish portfolio"
              }
            ),
            /* @__PURE__ */ jsx("button", { type: "button", className: "btn-secondary", onClick: copyLink, children: "Copy link" }),
            /* @__PURE__ */ jsx(
              "a",
              {
                className: "btn-secondary",
                href: "mailto:?subject=My%20CloseDeck%20portfolio&body=Here%20is%20my%20portfolio%3A%20https%3A%2F%2F" + shareSlug,
                children: "Email it to a manager"
              }
            ),
            data.published ? /* @__PURE__ */ jsx("button", { type: "button", className: "text-sm font-medium text-ink/60 hover:underline", onClick: () => set("published", false), children: "Set back to private" }) : null
          ] }),
          !readyToPublish ? /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm text-amber-700", children: "Add your name, a headline, and one mock call first." }) : null,
          copied ? /* @__PURE__ */ jsx("p", { className: "mt-3 text-sm text-ink/70", children: copied }) : null,
          /* @__PURE__ */ jsxs("p", { className: "mt-4 text-sm text-ink/60", children: [
            "Status: ",
            data.published ? "Published. Anyone with the link can view it." : "Private draft. Only you see this page."
          ] })
        ] }),
        /* @__PURE__ */ jsxs("section", { className: CARD_PAD, children: [
          /* @__PURE__ */ jsx("h3", { className: "font-display text-lg text-ink", children: "Before you send it" }),
          /* @__PURE__ */ jsx("ul", { className: "mt-3 space-y-2", children: checklist.map((c) => /* @__PURE__ */ jsxs("li", { className: "flex items-center gap-3 text-sm", children: [
            /* @__PURE__ */ jsx(
              "span",
              {
                className: c.done ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white" : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-slate-300 text-xs font-bold text-slate-400",
                children: c.done ? "\u2713" : ""
              }
            ),
            /* @__PURE__ */ jsx("span", { className: c.done ? "text-ink" : "text-ink/60", children: c.label })
          ] }, c.label)) })
        ] })
      ] }) : null
    ] }),
    /* @__PURE__ */ jsx("p", { className: "mt-10 text-xs text-ink/50", children: "Everything on this page lives in this browser only. Clearing your site data clears the draft, so keep your recording links somewhere else too." })
  ] });
}
createRoot(document.getElementById("tibly-app-root")).render(/* @__PURE__ */ jsx(App, {}));
export {
  App as default
};
